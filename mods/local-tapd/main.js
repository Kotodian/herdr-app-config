import { View, div, svg } from "gpui-kit";
import { h_flex, v_flex, Button, Input, InputState, TextView } from "gpui-base";
import { theme, exec, appHome, home, nextCommand } from "herdr";
import { tokens, G, T, quietTabs, iconButton, section, controlInput, quietLink } from "./ui.js";
import { commitLayout } from "./layout.js";
const ICON="mods/local-tapd/icon.svg";
const priorityName={urgent:"紧急",high:"高",medium:"中",low:"低",insignificant:"可忽略",'1':"紧急",'2':"高",'3':"中",'4':"低"};
const severityName={fatal:"致命",serious:"严重",normal:"一般",prompt:"提示",advice:"建议"};
const shortId=r => String(r.id ?? "").slice(-9).replace(/^0+/,"");
export default class TapdPanel extends View {
  init(_p,cx) {
    this.handle=cx.focus_handle();this.search=InputState.new({placeholder:"搜索标题、编号、项目"});
    this.search.on("change",(_e,cx)=>cx.notify());
    this.data=null;this.busy=false;this.error=null;this.selected=null;this.detail=null;this.detailError=null;this.project="all";this.filter="open";
    this.load(cx);cx.timer.every(120000,cx=>this.load(cx));
    cx.spawn(async cx => {for (;;) {
      const cmd=String(await nextCommand()).replace(/^local-tapd\./,"");
      if(cmd==="refresh")this.load(cx);
      if(cmd==="back"){this.selected=null;this.detail=null;this.detailError=null;cx.notify();}
      if(cmd.startsWith("bug:")) {const r=this.data?.bugs?.find(b=>b.id===cmd.slice(4));if(r)this.show(r,cx);}
    }});
  }
  async request(args) {
    const r=await exec("/usr/bin/python3",[`${appHome()}/mods/local-tapd/tapd_bridge.py`,JSON.stringify(args)],{timeout:180000});
    if(r.code!==0)throw new Error("TAPD 查询未完成，请检查现有连接后刷新");
    let result;try{result=JSON.parse(r.stdout);}catch(_){throw new Error("TAPD 返回格式异常");}
    if(!result.ok)throw new Error(result.error);return result.data;
  }
  load(cx) {
    if(this.busy)return;this.busy=true;this.error=null;cx.notify();
    cx.spawn(async cx=>{
      try{this.data=await this.request({action:"snapshot"});this.at=Date.now();if(!this.data.projects.some(p=>p.id===this.project))this.project="all";}
      catch(e){this.error=String(e.message??e);}
      finally{this.busy=false;cx.notify();}
    });
  }
  show(row,cx) {
    this.selected=row;this.detail=null;this.detailError=null;cx.notify();
    cx.spawn(async cx=>{
      try{const data=await this.request({action:"detail",workspace:row.workspace_id,id:row.id});if(this.selected?.id===row.id)this.detail=data;}
      catch(e){if(this.selected?.id===row.id)this.detailError=String(e.message??e);}
      cx.notify();
    });
  }
  text(value,c,color=c.dim){return div().text_size(T.body).text_color(color).child(value);}
  row(label,value,c){return h_flex().gap(G.md).py(8).border_b(1).border_color(c.border).child(this.text(label,c,c.muted)).child(div().flex_1().min_w(0).text_right().child(value||"—"));}
  list(c) {
    const all=this.data?.bugs??[],projectRows=all.filter(r=>this.project==="all"||r.workspace_id===this.project);
    const q=this.search.value().trim().toLowerCase();
    const shown=projectRows.filter(r=>this.filter==="all"||(this.filter==="open"?!r.closed:r.closed)).filter(r=>`${r.title} ${r.id} ${r.project}`.toLowerCase().includes(q));
    const open=projectRows.filter(r=>!r.closed).length,complete=this.data&&!this.error&&!this.data.errors?.length;
    return v_flex().flex_1().min_h(0)
      .child(v_flex().flex_none().p(G.lg).gap(G.md)
        .child(h_flex().items_end().gap(G.sm).child(div().text_size(28).font_medium().child(complete?String(open):"—")).child(div().pb(3).text_color(c.dim).child("待处理 Bug")))
        .child(this.text(this.data?`分配给 ${this.data.user} · 按最近更新排序`:"正在确认账号和项目…",c))
        .child(quietTabs("tapd-projects",[{key:"all",label:"全部项目"},...(this.data?.projects??[]).map(p=>({key:p.id,label:p.name}))],this.project,(key,cx)=>{this.project=key;cx.notify();},c))
        .child(quietTabs("tapd-filter",[{key:"open",label:`待处理 ${open}`},{key:"all",label:`全部 ${projectRows.length}`},{key:"closed",label:"已结束"}],this.filter,(key,cx)=>{this.filter=key;cx.notify();},c))
        .child(controlInput(Input.new(this.search),c).w_full()))
      .child(v_flex().id("tapd-bugs").flex_1().min_h(0).overflow_y_scrollbar().px(G.lg).pb(G.lg).gap(G.sm)
        .when(!shown.length,el=>el.child(v_flex().py(G.xl).gap(G.md)
          .child(div().text_size(T.card).child(this.busy?"正在读取我的 Bug…":!complete?"暂未取得完整列表":!projectRows.length?"当前没有分配给你的 Bug":"没有符合筛选条件的 Bug"))
          .child(this.text(!complete?"请查看上方连接提示后刷新。":`当前处理人：${this.data.user}。可切换“全部”查看已结束的记录。`,c))))
        .children(shown.map(r=>Button.new(`tapd-bug-${r.workspace_id}-${r.id}`).w_full().p(G.md).rounded(6).cursor_pointer().hover(s=>s.bg(c.subtle)).focus(s=>s.bg(c.selected))
          .accessibility_label(`查看 Bug ${shortId(r)} ${r.title}`).on_click((_e,cx)=>this.show(r,cx))
          .child(v_flex().w_full().min_w(0).gap(G.sm)
            .child(h_flex().gap(G.sm).items_center().child(this.text(`#${shortId(r)}`,c)).child(div().flex_1())).child(div().text_size(T.card).child(r.title||"未命名缺陷"))
            .child(h_flex().justify_between().gap(G.sm)
              .child(this.text(r.status_label,c,r.closed?c.dim:c.text))
              .child(this.text(r.priority_label||priorityName[r.priority]||r.priority||"未设优先级",c,["urgent","high","1","2"].includes(String(r.priority))?c.yellow:c.dim)))
            .child(this.text(`${r.project} · ${r.modified||"—"}`,c)))
          .border_b(1).border_color(c.border))));
  }
  details(c) {
    const r=this.detail??this.selected;
    return v_flex().id("tapd-detail").flex_1().min_h(0).overflow_y_scrollbar().p(G.lg).gap(G.lg)
      .child(this.text(`${r.project} · #${shortId(r)}`,c))
      .child(div().text_size(T.page).child(r.title||"未命名缺陷"))
      .child(v_flex().child(this.row("状态",r.status_label,c)).child(this.row("优先级",r.priority_label||priorityName[r.priority]||r.priority,c))
        .child(this.row("严重程度",severityName[r.severity]||r.severity,c)).child(this.row("当前处理人",r.current_owner,c))
        .child(this.row("报告人",r.reporter,c)).child(this.row("更新时间",r.modified,c)).child(this.row("截止日期",r.deadline,c)))
      .child(v_flex().gap(G.md).child(section(c,"缺陷描述"))
        .when(Boolean(this.detailError),el=>el.child(this.text(this.detailError,c,c.yellow)))
        .when(!this.detail&&!this.detailError,el=>el.child(this.text("读取详情…",c)))
        .when(Boolean(this.detail),el=>el.child(TextView.markdown(`tapd-description-${r.id}`,this.detail.description||"暂无描述").text_size(T.value).text_color(c.text))))
      .child(quietLink("tapd-browser","在 TAPD 打开",cx=>{cx.spawn(async cx=>{try{await exec("/usr/bin/open",[r.url]);}catch(_){this.detailError="无法打开浏览器";cx.notify();}});},c));
  }
  render() {
    const c=tokens(theme());
    return v_flex().id("tapd-panel").size_full().min_w(0).min_h(0).bg(c.canvas).text_color(c.text).text_size(T.value).track_focus(this.handle)
      .child(h_flex().flex_none().h(46).px(G.lg).gap(G.sm).items_center().border_b(1).border_color(c.border)
        .when(Boolean(this.selected),el=>el.child(iconButton("tapd-back","chevron-left","返回我的 Bug",cx=>{this.selected=null;this.detail=null;this.detailError=null;cx.notify();},c)))
        .child(svg(ICON).size(16).text_color(c.muted)).child(div().flex_1().font_medium().text_size(T.card).child("TAPD · 我的 Bug"))
        .child(iconButton("tapd-refresh","refresh","刷新我的 Bug",cx=>{this.load(cx);if(this.selected)this.show(this.selected,cx);},c,{disabled:this.busy,spin:this.busy}))
        .child(iconButton("tapd-close","close","关闭面板",()=>commitLayout({panel:null}),c)))
      .when(Boolean(this.error),el=>el.child(div().flex_none().px(G.lg).py(G.sm).child(this.text(`${this.error}${this.data?" · 下方为上次缓存":""}`,c,c.yellow))))
      .children((this.data?.errors??[]).map(e=>div().flex_none().px(G.lg).py(G.sm).child(this.text(`${e.project}：${e.message}`,c,c.yellow))))
      .child(this.selected?this.details(c):this.list(c))
      .child(h_flex().flex_none().h(30).px(G.lg).items_center().border_t(1).border_color(c.border).text_size(T.small).text_color(c.dim)
        .child(div().flex_1().child(this.data?.user??"TAPD"))
        .child(this.at?`更新于 ${new Date(this.at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})} · 2 分钟刷新`:"连接中…"));
  }
}
