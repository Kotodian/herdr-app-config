import { View, div, svg } from "gpui-kit";
import { h_flex, v_flex, Button, Input, InputState, TextView } from "gpui-base";
import { theme, exec, appHome, home, nextCommand, focused, shared, setShared } from "herdr";
import { tokens, G, T, quietTabs, iconButton, section, controlInput, quietLink } from "./ui.js";
import { commitLayout } from "./panels.js";
import * as fs from "fs/promises";
const ICON="mods/local-tapd/icon.svg";
const priorityName={urgent:"紧急",high:"高",medium:"中",low:"低",insignificant:"可忽略",'1':"紧急",'2':"高",'3':"中",'4':"低"};
const severityName={fatal:"致命",serious:"严重",normal:"一般",prompt:"提示",advice:"建议"};
const shortId=r => String(r.id ?? "").slice(-9).replace(/^0+/,"");
export default class TapdPanel extends View {
  init(_p,cx) {
    this.handle=cx.focus_handle();this.search=InputState.new({placeholder:"搜索标题、编号、项目"});
    this.search.on("change",(_e,cx)=>cx.notify());
    this.memberSearch=InputState.new({placeholder:"搜索处理人姓名或账号"});
    this.memberSearch.on("change",(_e,cx)=>cx.notify());
    this.owner=null;this.picker=null;this.generation=0;this.detailGeneration=0;this.saving=false;this.fieldInputs={};
    this.data=null;this.busy=false;this.error=null;this.selected=null;this.detail=null;this.detailError=null;this.project="all";this.filter="open";
    this.load(cx);cx.timer.every(120000,cx=>this.load(cx));
    cx.timer.every(500,cx=>this.assistantResult(cx));
    cx.spawn(async cx => {for (;;) {
      const cmd=String(await nextCommand()).replace(/^local-tapd\./,"");
      if(cmd==="refresh")this.load(cx);
      if(cmd==="owners"){this.picker=this.picker==="filter"?null:"filter";this.memberSearch.set_value("");cx.notify();}
      if(cmd==="back"&&!this.saving){this.back(cx);}
      if(cmd.startsWith("bug:")) {const r=this.data?.bugs?.find(b=>b.id===cmd.slice(4));if(r)this.show(r,cx);}
    }});
  }
  close() {
    this.generation++;this.detailGeneration++;this.search.release();this.memberSearch.release();
    Object.values(this.fieldInputs).forEach(input=>input.release());
  }
  back(cx) {this.detailGeneration++;this.selected=null;this.detail=null;this.detailError=null;this.picker=null;cx.notify();}
  addToAssistant(row,cx) {
    const space=focused()?.space,target=space&&shared(`context.assistant.${space}`);
    this.assistantMessage=null;this.assistantError=null;
    if(!row.dragPath){this.assistantError="Bug 引用尚未就绪，请刷新列表后重试。";cx.notify();return;}
    if(!target||Date.now()-target.at>3500){this.assistantError="请先打开当前 Space 的 Assistant 聊天，等待草稿就绪后重试。";cx.notify();return;}
    const key=`context.request.${space}`,previous=shared(key);
    if(["pending","loading"].includes(previous?.status)&&Date.now()-previous.at<190000){
      this.assistantError="正在向此 Space 的 Assistant 添加 Bug，请稍候。";cx.notify();return;
    }
    const request=`${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.assistantSpace=space;
    this.assistantPending={space,request};
    setShared(key,{request,target:target.target,draft:target.draft,source:"tapd",workspace:String(row.workspace_id),bug:String(row.id),status:"pending",at:Date.now()});
    this.assistantMessage="正在读取 Bug 并加入当前 Space 的 Assistant 草稿…";cx.notify();
  }
  assistantResult(cx) {
    if(this.assistantSpace&&this.assistantSpace!==focused()?.space){
      this.assistantMessage=null;this.assistantError=null;this.assistantSpace=null;cx.notify();
    }
    const pending=this.assistantPending;if(!pending)return;
    const result=shared(`context.request.${pending.space}`);
    if(result?.request!==pending.request){
      this.assistantPending=null;this.assistantMessage=null;this.assistantError="添加请求已失效，请重试。";cx.notify();return;
    }
    if(["pending","loading"].includes(result.status)&&pending.space!==focused()?.space){
      setShared(`context.request.${pending.space}`,{...result,status:"error",message:"Space 已切换，请回到目标 Assistant 后重新添加。"});
    }else if(["done","error"].includes(result.status)){
      this.assistantPending=null;this.assistantMessage=result.status==="done"?result.message:null;
      this.assistantError=result.status==="error"?result.message:null;cx.notify();
    }else if(Date.now()-result.at>(result.status==="pending"?10000:190000)){
      setShared(`context.request.${pending.space}`,{...result,status:"error",message:"Assistant 未能接收此 Bug，请打开目标聊天后重试。"});
    }
  }
  async request(args) {
    const r=await exec("/usr/bin/python3",[`${appHome()}/mods/local-tapd/tapd_bridge.py`,JSON.stringify(args)],{timeout:180000});
    if(r.code!==0)throw new Error("TAPD 查询未完成，请检查现有连接后刷新");
    let result;try{result=JSON.parse(r.stdout);}catch(_){throw new Error("TAPD 返回格式异常");}
    if(!result.ok)throw new Error(result.error);return result.data;
  }
  load(cx) {
    const generation=++this.generation,owner=this.owner;
    this.busy=true;this.error=null;cx.notify();
    cx.spawn(async cx=>{
      try{
        const data=await this.request({action:"snapshot",...(owner?{owner}:{})});
        await fs.mkdir(`${appHome()}/data/tapd-drag`,{recursive:true});
        await Promise.all(data.bugs.map(async r=>{
          if(!/^\d+$/.test(r.workspace_id)||!/^\d{10,30}$/.test(r.id))return;
          const path=`${appHome()}/data/tapd-drag/${r.workspace_id}-${r.id}.tapd.json`;
          await fs.writeFile(path,JSON.stringify({kind:"tapd-bug",workspace:r.workspace_id,id:r.id}));
          r.dragPath=path;
        }));
        if(generation!==this.generation)return;
        this.data=data;this.owner=data.owner;this.at=Date.now();if(!this.data.projects.some(p=>p.id===this.project))this.project="all";
      }
      catch(e){if(generation===this.generation)this.error=String(e.message??e);}
      finally{if(generation===this.generation){this.busy=false;cx.notify();}}
    });
  }
  show(row,cx) {
    const generation=++this.detailGeneration;
    this.selected=row;this.detail=null;this.detailError=null;this.options=null;this.targetOwner=null;this.targetStatus=null;this.picker=null;
    Object.values(this.fieldInputs).forEach(input=>input.release());this.fieldInputs={};cx.notify();
    cx.spawn(async cx=>{
      try{
        const data=await this.request({action:"detail",workspace:row.workspace_id,id:row.id});
        if(generation!==this.detailGeneration)return;this.detail=data;cx.notify();
        const options=await this.request({action:"options",workspace:row.workspace_id,id:row.id});
        if(generation===this.detailGeneration)this.options=options;
      }
      catch(e){if(generation===this.detailGeneration)this.detailError=String(e.message??e);}
      if(generation===this.detailGeneration)cx.notify();
    });
  }
  action(id,label,fn,c,disabled=false) {
    return Button.new(id).px(10).py(6).rounded(5).bg(c.subtle).text_color(c.text).disabled(disabled)
      .on_click((_e,cx)=>{cx.stop_propagation();if(!disabled)fn(cx);}).child(label);
  }
  memberPicker(id,users,selected,choose,c) {
    const q=this.memberSearch.value().trim().toLowerCase();
    const rows=users.filter(u=>`${u.user} ${u.name}`.toLowerCase().includes(q));
    return v_flex().gap(G.sm).p(G.sm).border_1().border_color(c.border).rounded(6)
      .child(controlInput(Input.new(this.memberSearch),c).w_full())
      .child(v_flex().id(id).h(Math.min(168,Math.max(28,rows.length*28))).flex_none().overflow_y_scrollbar()
        .when(!rows.length,el=>el.child(this.text("没有匹配的处理人",c)))
        .children(rows.map(u=>div().id(`${id}-${u.user}`).h(28).flex_none().px(6).cursor_pointer().hover(s=>s.bg(c.subtle))
          .text_color(u.user===selected?c.text:c.dim).on_click((_e,cx)=>choose(u.user,cx))
          .child(u.name===u.user?u.user:`${u.name} · ${u.user}`))));
  }
  chooseStatus(option,cx) {
    this.targetStatus=option.key;this.picker=null;
    Object.values(this.fieldInputs).forEach(input=>input.release());this.fieldInputs={};
    for(const f of option.fields??[]){
      const input=InputState.new({placeholder:`必填 · ${f.label??f.name}`});input.set_value(f.value??"");
      input.on("change",(_e,cx)=>cx.notify());this.fieldInputs[f.name]=input;
    }
    cx.notify();
  }
  save(cx) {
    if(this.saving||!this.detail||!this.options)return;
    const row=this.selected,detail=this.detail,generation=this.detailGeneration,changes={};
    if(this.targetOwner)changes.current_owner=this.targetOwner;
    if(this.targetStatus&&this.targetStatus!==detail.status){
      changes.status=this.targetStatus;changes.fields=Object.fromEntries(Object.entries(this.fieldInputs).map(([k,v])=>[k,v.value()]));
    }
    if(!Object.keys(changes).length)return;
    this.saving=true;this.detailError=null;this.message=null;cx.notify();
    cx.spawn(async cx=>{
      try{
        const saved=await this.request({action:"update",workspace:detail.workspace_id,id:detail.id,changes,
          expected:{modified:detail.modified,status:detail.status,current_owner:detail.current_owner}});
        if(generation!==this.detailGeneration)return;
        this.message=`已更新 #${shortId(saved)} · ${saved.current_owner||"未分配"} · ${saved.status_label}`;
        this.show({...saved,dragPath:row.dragPath},cx);this.load(cx);
      }catch(e){if(generation===this.detailGeneration)this.detailError=String(e.message??e);}
      finally{this.saving=false;cx.notify();}
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
        .child(this.action("tapd-owner-filter",`处理人 · ${this.owner??"我"} ▾`,cx=>{this.picker=this.picker==="filter"?null:"filter";this.memberSearch.set_value("");cx.notify();},c,!this.data))
        .when(this.picker==="filter",el=>el.child(this.memberPicker("tapd-owner-members",this.data?.users??[],this.owner,(owner,cx)=>{
          this.owner=owner;this.picker=null;this.data={...this.data,bugs:[]};this.load(cx);
        },c)))
        .child(this.text(this.owner?`分配给 ${this.owner} · 按最近更新排序`:"正在确认账号和项目…",c))
        .child(quietTabs("tapd-projects",[{key:"all",label:"全部项目"},...(this.data?.projects??[]).map(p=>({key:p.id,label:p.name}))],this.project,(key,cx)=>{this.project=key;cx.notify();},c))
        .child(quietTabs("tapd-filter",[{key:"open",label:`待处理 ${open}`},{key:"all",label:`全部 ${projectRows.length}`},{key:"closed",label:"已结束"}],this.filter,(key,cx)=>{this.filter=key;cx.notify();},c))
        .child(controlInput(Input.new(this.search),c).w_full()))
      .child(v_flex().id("tapd-bugs").flex_1().min_h(0).overflow_y_scrollbar().px(G.lg).pb(G.lg).gap(G.sm)
        .when(!shown.length,el=>el.child(v_flex().py(G.xl).gap(G.md)
          .child(div().text_size(T.card).child(this.busy?"正在读取我的 Bug…":!complete?"暂未取得完整列表":!projectRows.length?"当前没有分配给你的 Bug":"没有符合筛选条件的 Bug"))
          .child(this.text(!complete?"请查看上方连接提示后刷新。":`所选处理人：${this.owner}。可切换“全部”查看已结束的记录。`,c))))
        .children(shown.map(r=>v_flex().id(`tapd-bug-${r.workspace_id}-${r.id}`).w_full().p(G.md).rounded(6).cursor_pointer().hover(s=>s.bg(c.subtle))
          .accessibility_label(`查看 Bug ${shortId(r)} ${r.title}`).on_click((_e,cx)=>this.show(r,cx))
          .child(v_flex().w_full().min_w(0).gap(G.sm)
            .child(h_flex().gap(G.sm).items_center().child(this.text(`#${shortId(r)}`,c)).child(div().flex_1())).child(div().text_size(T.card).child(r.title||"未命名缺陷"))
            .child(h_flex().justify_between().gap(G.sm)
              .child(this.text(r.status_label,c,r.closed?c.dim:c.text))
              .child(this.text(r.priority_label||priorityName[r.priority]||r.priority||"未设优先级",c,["urgent","high","1","2"].includes(String(r.priority))?c.yellow:c.dim)))
            .child(this.text(`${r.project} · ${r.modified||"—"}`,c)))
          .child(this.action(`tapd-assistant-${r.workspace_id}-${r.id}`,"加入 Assistant",cx=>this.addToAssistant(r,cx),c,Boolean(this.assistantPending)||!r.dragPath))
          .border_b(1).border_color(c.border))));
  }
  details(c) {
    const r=this.detail??this.selected;
    return v_flex().id("tapd-detail").flex_1().min_h(0).overflow_y_scrollbar().p(G.lg).gap(G.lg)
      .child(this.text(`${r.project} · #${shortId(r)}`,c))
      .child(div().text_size(T.page).child(r.title||"未命名缺陷"))
      .child(this.action("tapd-detail-assistant","加入 Assistant",cx=>this.addToAssistant(this.selected,cx),c,Boolean(this.assistantPending)||!this.selected?.dragPath))
      .child(this.text("加入当前 Space 的 Assistant 草稿，确认后随下一条消息发送",c))
      .child(v_flex().child(this.row("状态",r.status_label,c)).child(this.row("优先级",r.priority_label||priorityName[r.priority]||r.priority,c))
        .child(this.row("严重程度",severityName[r.severity]||r.severity,c)).child(this.row("当前处理人",r.current_owner,c))
        .child(this.row("报告人",r.reporter,c)).child(this.row("更新时间",r.modified,c)).child(this.row("截止日期",r.deadline,c)))
      .when(Boolean(this.options),el=>el.child(v_flex().gap(G.md)
        .child(section(c,"更新状态 / 转交 Bug"))
        .child(this.action("tapd-new-owner",`转交给 · ${this.targetOwner??r.current_owner??"选择处理人"} ▾`,cx=>{
          this.picker=this.picker==="edit-owner"?null:"edit-owner";this.memberSearch.set_value("");cx.notify();
        },c,this.saving))
        .when(this.picker==="edit-owner",el=>el.child(this.memberPicker("tapd-transfer-members",this.options.users,this.targetOwner,(owner,cx)=>{
          this.targetOwner=owner;this.picker=null;cx.notify();
        },c)))
        .child(this.action("tapd-new-status",`状态 · ${this.options.statuses.find(s=>s.key===this.targetStatus)?.label??r.status_label} ▾`,cx=>{
          this.picker=this.picker==="edit-status"?null:"edit-status";cx.notify();
        },c,this.saving))
        .when(this.picker==="edit-status",el=>el.child(v_flex().gap(2).children(this.options.statuses.map(option=>
          this.action(`tapd-status-${option.key}`,option.label,cx=>this.chooseStatus(option,cx),c,this.saving)))))
        .children(Object.entries(this.fieldInputs).map(([name,input])=>v_flex().gap(G.sm).child(this.text(`必填 · ${this.options.statuses.find(s=>s.key===this.targetStatus)?.fields?.find(f=>f.name===name)?.label??name}`,c))
          .child(controlInput(Input.new(input),c).w_full())))
        .child(this.action("tapd-save-update",this.saving?"保存中…":"保存状态 / 转交",cx=>this.save(cx),c,
          this.saving||(!this.targetOwner&&(!this.targetStatus||this.targetStatus===r.status))))
        .child(this.text("点击保存后更新 TAPD；转交后会从原处理人的列表移出。",c))))
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
        .when(Boolean(this.selected),el=>el.child(iconButton("tapd-back","chevron-left","返回 Bug 列表",cx=>this.back(cx),c,{disabled:this.saving})))
        .child(svg(ICON).size(16).text_color(c.muted)).child(div().flex_1().font_medium().text_size(T.card).child("TAPD · Bug"))
        .child(iconButton("tapd-refresh","refresh","刷新 Bug",cx=>{this.load(cx);if(this.selected)this.show(this.selected,cx);},c,{disabled:this.busy||this.saving,spin:this.busy}))
        .child(iconButton("tapd-close","close","关闭面板",()=>commitLayout({panel:null}),c,{disabled:this.saving})))
      .when(Boolean(this.error),el=>el.child(div().flex_none().px(G.lg).py(G.sm).child(this.text(`${this.error}${this.data?" · 下方为上次缓存":""}`,c,c.yellow))))
      .when(Boolean(this.message),el=>el.child(div().flex_none().px(G.lg).py(G.sm).child(this.text(this.message,c,c.green))))
      .when(Boolean(this.assistantMessage||this.assistantError),el=>el.child(div().flex_none().px(G.lg).py(G.sm)
        .child(this.text(this.assistantError||this.assistantMessage,c,this.assistantError?c.yellow:c.green))))
      .children((this.data?.errors??[]).map(e=>div().flex_none().px(G.lg).py(G.sm).child(this.text(`${e.project}：${e.message}`,c,c.yellow))))
      .child(this.selected?this.details(c):this.list(c))
      .child(h_flex().flex_none().h(30).px(G.lg).items_center().border_t(1).border_color(c.border).text_size(T.small).text_color(c.dim)
        .child(div().flex_1().child(this.data?.user??"TAPD"))
        .child(this.at?`更新于 ${new Date(this.at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})} · 2 分钟刷新`:"连接中…"));
  }
}
