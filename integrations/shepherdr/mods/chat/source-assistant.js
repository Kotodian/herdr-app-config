import { appHome, focused, shared, setShared } from "herdr";
import { tapdReference } from "./core/tapd-attachment.js";
import { sourceRef } from "./core/context-source.js";
import * as attach from "./attach.js";

export class SourceAssistant {
  constructor(chat) {
    this.chat = chat;
    this.token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.generation = 0;
  }

  destination() {
    const chat = this.chat;
    if (chat.thread || chat.inner || chat.sourceClosed || !chat.draftLoaded || chat.call ||
        !["fresh", "ready"].includes(chat.phase)) return null;
    const assistant = chat.assistant();
    if (!assistant && chat.role !== "coordinator") return null;
    const origin = chat.slotRec()?.space ?? assistant;
    const space = chat.machine && origin && !origin.includes("/") ? `${chat.machine}/${origin}` : origin;
    return space && focused()?.space === space ? space : null;
  }

  close() {
    this.generation++;
    const key = `context.request.${this.space}`, request = this.space && shared(key);
    if (request?.target === this.token && ["pending", "loading"].includes(request.status))
      setShared(key, { ...request, status: "error", message: "Space 或 Assistant 已关闭，请重新添加。" });
    if (this.space && shared(`context.assistant.${this.space}`)?.target === this.token)
      setShared(`context.assistant.${this.space}`, null);
  }

  tick(cx) {
    const space = this.destination();
    if (this.space && this.space !== space) this.close();
    this.space = space;
    if (!space) return;
    const chat = this.chat, now = Date.now(), key = `context.request.${space}`;
    const presence = shared(`context.assistant.${space}`);
    if (presence?.target !== this.token || presence.draft !== chat.draftFile || now - presence.at > 1000)
      setShared(`context.assistant.${space}`, { target: this.token, draft: chat.draftFile, at: now });
    const request = shared(key);
    if (this.running || request?.status !== "pending" || request.target !== this.token) return;
    const finish = (status, message) => {
      if (shared(key)?.request === request.request)
        setShared(key, { ...request, status, message });
    };
    if (request.draft !== chat.draftFile || now - request.at > 10000) {
      finish("error", "Assistant 草稿已变化，请重新添加。");
      return;
    }
    this.running = true;
    const draft = chat.draftFile, generation = this.generation;
    setShared(key, { ...request, status: "loading" });
    chat.dropBusy = (chat.dropBusy ?? 0) + 1;
    cx.notify();
    cx.spawn(async cx => {
      let file = null;
      try {
        let path, url;
        if (request.source === "tapd") {
          const ref = tapdReference({ kind: "tapd-bug", workspace: request.workspace, id: request.bug });
          url = `https://www.tapd.cn/${ref.workspace}/bugtrace/bugs/view/${ref.id}`;
          path = `${appHome()}/data/tapd-drag/${ref.workspace}-${ref.id}.tapd.json`;
        } else if (request.source === "github") {
          const ref = sourceRef("github", request.url);
          url = ref.url;
          path = `${appHome()}/data/github-issue-drag/${ref.repo.replace("/", "--")}-${ref.number}.issue.json`;
        } else {
          throw new Error("不支持的附件来源，请从 TAPD 或 GitHub Issues 面板重试。");
        }
        if (chat.files.some(item => item.source === request.source && item.url === url)) {
          finish("done", "此内容已在 Assistant 草稿中。");
          return;
        }
        if (chat.files.length >= 20) throw new Error("每条消息最多添加 20 个附件，请先移除一个附件。");
        const where = chat.sourceSpace();
        if (request.source === "github" && where?.id !== space)
          throw new Error("当前 Space 仓库尚未就绪，请稍后重试。");
        const context = `${where?.id}:${where?.machine}:${where?.folder}`;
        file = await attach.droppedFile(path, where);
        const current = chat.sourceSpace();
        if (this.destination() !== space || chat.draftFile !== draft || generation !== this.generation ||
            shared(key)?.request !== request.request || shared(key)?.status !== "loading" ||
            (request.source === "github" && `${current?.id}:${current?.machine}:${current?.folder}` !== context))
          throw new Error("Space 或 Assistant 草稿已变化，请回到目标 Assistant 后重新添加。");
        if (chat.files.length >= 20) throw new Error("附件已满，请先移除一个附件。");
        if (file.source !== request.source || file.url !== url)
          throw new Error("附件引用已变化，请刷新来源面板后重试。");
        if (chat.files.some(item => item.source === request.source && item.url === url)) {
          finish("done", "此内容已在 Assistant 草稿中。");
          return;
        }
        chat.addFiles([file]);
        file = null;
        chat.saveSoon(cx);
        finish("done", "已加入当前 Space 的 Assistant 草稿，可预览、移除，发送后才会交给 Assistant。");
      } catch (error) {
        finish("error", String(error?.message ?? "无法读取附件内容，请重试。"));
      } finally {
        if (file) attach.drop(file);
        this.running = false;
        chat.dropBusy--;
        cx.notify();
      }
    });
  }
}
