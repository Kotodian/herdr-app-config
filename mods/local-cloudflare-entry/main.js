import { View, svg } from "gpui-kit";
import { Button, h_flex } from "gpui-base";
import { shared, setShared, theme, layout, nextCommand } from "herdr";
import { walkLayout, commitLayout } from "./layout.js";
export default class CloudflareEntry extends View {
  init(_p,cx) {
    const old=Array.isArray(shared("kanso.panels")) ? shared("kanso.panels") : [];
    const entry={id:"cloudflare",label:"Cloudflare",icon:"mods/local-cloudflare/icon.svg",mod:"local-cloudflare",props:{role:"panel"}};
    const list=old.some(p => p.id===entry.id) ? old.map(p => p.id===entry.id ? entry : p) : [...old,entry];
    if (JSON.stringify(old)!==JSON.stringify(list)) setShared("kanso.panels",list);
    cx.spawn(async cx => { for (;;) { const command=String(await nextCommand()).replace(/^local-cloudflare-entry\./,""); if (command==="open") this.open(); } });
  }
  open() {
    const body=walkLayout(layout(),"panel-body");
    if (body) commitLayout({panel:!body.hidden && body.children?.[0]?.id==="cloudflare" ? null : {id:"cloudflare",type:"block",content:{mod:"local-cloudflare",props:{role:"panel"}}}});
  }
  render() {
    const c=theme();
    return Button.new("cloudflare-entry").size_full().items_center().justify_center().rounded(6).cursor_pointer()
      .accessibility_label("打开 Cloudflare DNS").tooltip("Cloudflare · DNS 管理").hover(s => s.bg(c.hover)).on_click(() => this.open())
      .child(h_flex().gap(6).items_center().text_color(c.muted).text_size(11.5).child(svg("mods/local-cloudflare/icon.svg").size(13)).child("Cloudflare"));
  }
}
