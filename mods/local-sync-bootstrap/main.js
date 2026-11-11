import { View, div, svg } from "gpui-kit";
import { Button, h_flex } from "gpui-base";
import { theme, appHome, home, exec, readTextFile, shared, setShared, layout, run, props } from "herdr";
const MOD="local-sync-bootstrap";
function hasEntry(n){return n?.content?.mod===MOD&&n?.content?.props?.role==="entry"||(n?.children??[]).some(hasEntry);}
function withoutDock(n){
  if(n?.content?.mod===MOD&&!n?.content?.props?.role)return null;
  return n?.children?{...n,children:n.children.map(withoutDock).filter(Boolean)}:n;
}
export default class ConfigSync extends View {
  init(_p,cx){
    this.status=null;this.busy=false;this.error=null;
    // The native checker has empty shared state; it must never start initialization.
    if(!shared("layout"))return;
    if(!shared("local.sync.onboarded")){
      setShared("local.sync.onboarded",true);
      if(shared("layout")==="main"){run("layout.switch",{name:"kanso"});return;}
    }
    // First discovery can dock a copy; kanso already has its compact status entry.
    if(!props()?.role&&shared("layout")==="kanso"&&hasEntry(layout())){
      run("layout.set",{layout:withoutDock(layout())});return;
    }
    this.sync(cx,true);
    cx.timer.every(15000,cx=>this.readStatus(cx));
    // Offline first launches retry automatically as well.
    cx.timer.every(300000,cx=>{if(this.error)this.sync(cx,true);});
  }
  readStatus(cx){cx.spawn(async cx=>{try{this.status=JSON.parse(await readTextFile(`${home()}/.config/herdr-app-sync/native-status.json`));if(this.status?.status==="ok"||this.status?.status==="pending")this.error=null;}catch(_){}cx.notify();});}
  sync(cx,first=false){
    if(this.busy)return;this.busy=true;this.error=null;cx.notify();
    cx.spawn(async cx=>{try{
      const r=await exec("/usr/bin/python3",[`${appHome()}/sync-app.py`,first?"bootstrap":"auto","--app-home",appHome()],{timeout:240000});
      if(r.code!==0)this.error="自动同步暂未完成，稍后重试";
    }catch(_){this.error="自动同步连接失败，稍后重试";}
    this.busy=false;this.readStatus(cx);cx.notify();});
  }
  render(){
    const c=theme(),failed=Boolean(this.error)||this.status?.status==="error",pending=this.status?.status==="pending";
    const label=this.busy?"同步中":failed?"同步 !":pending?"待同步":this.status?.last_success?"同步 ✓":"同步";
    const tip=this.busy?"正在初始化或同步配置":failed?(this.status?.error||this.error):pending?"配置有新变化，将在下一轮继续同步":`自动同步 · 登录时及每 5 分钟${this.status?.last_success?` · 上次成功 ${new Date(this.status.last_success).toLocaleTimeString()}`:""}`;
    return Button.new("native-config-sync").size_full().rounded(6).items_center().justify_center().cursor_pointer().disabled(this.busy)
      .accessibility_label(label).tooltip(tip).hover(s=>s.bg(c.hover)).on_click((_e,cx)=>this.sync(cx))
      .child(h_flex().gap(6).items_center().text_size(11.5).text_color(failed?c.ansi3:c.muted)
        .child(svg("mods/kanso-chrome/icons/refresh.svg").size(13).when(this.busy,e=>e.spin(900))).child(div().child(label)));
  }
}
