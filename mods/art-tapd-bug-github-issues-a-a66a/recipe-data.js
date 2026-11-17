// Written by herdr-artifact from recipe.json.
export default {
  "recipe": 1,
  "blocks": [
    {
      "type": "text",
      "md": "TAPD 和 GitHub Issues 的列表与详情均提供「加入 Assistant」，把完整内容加入当前 Space 的 Assistant 草稿。保留现有草稿，支持预览、移除和随下一条消息发送。"
    },
    {
      "type": "text",
      "md": "根因：原生 drag_paths 面向终端；聊天 on_drop 接收外部文件，二者无法组成内部拖放。修复共用带 Space、聊天实例和草稿校验的 shared/setShared 桥接，复用现有只读附件读取。"
    },
    {
      "type": "text",
      "md": "修改前后对照：把同一入口回归放到原 dev 面板，TAPD 和 GitHub 列表/详情入口检查失败；修改后的面板通过。以下为本次实际命令结果摘要。"
    },
    {
      "type": "code",
      "lang": "text",
      "text": "Original dev panels FAIL the same TAPD and GitHub list/detail action regression tests.\n\nbun test integrations/shepherdr/service/source-assistant.test.ts\n15 pass, 0 fail, 74 expect() calls\n\n来源与 Issue 操作定向回归：19 pass, 0 fail\nTAPD Python bridge：Ran 9 tests — OK\n配置仓库 Python tests：Ran 30 tests — OK\nsync-shared: all 267 copies match lib/ and core/\nJS syntax checks / git diff --check：通过"
    },
    {
      "type": "text",
      "md": "原生检查记录：聊天、TAPD、GitHub Issues 三个相关 mod 的 herdr-app check 已通过。临时聊天热更新与测试入口已撤回，正式 local-tapd、持久化 integration 和 main 未被本任务修改。"
    },
    {
      "type": "heading",
      "text": "Not proven",
      "level": 2
    },
    {
      "type": "list",
      "items": [
        "按用户最新要求，未把真实 Bug 或 Issue 投递到真实用户草稿，未发送测试消息。",
        "联动与异常路径测试使用模拟快照读取器，不能替代真实用户草稿的端到端验收。",
        "未声称实现原生拖拽；交付的是两个来源面板的一键草稿联动。",
        "按用户要求跳过模型评审。未合并、上线或启用正式运行副本。"
      ]
    }
  ]
};
