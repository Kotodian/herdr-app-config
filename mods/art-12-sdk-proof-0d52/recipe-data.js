// Written by herdr-artifact from recipe.json.
export default {
  "recipe": 1,
  "blocks": [
    {
      "type": "text",
      "md": "已把实际路由、出口、健康和探测实现迁入设计第十二节的目录；公开配置与生命周期实现保持原样。这里只验收目录职责纠正，不声称整个原设计已完成功能验收。"
    },
    {
      "type": "text",
      "md": "候选提交：`acadc79404e32fe5ef5e787cf9816523e6fa6631`。基线为任务启动时的 `681da85`；当前 dev 的后续变化来自 SPS-3 绑定适配，本任务未改 bindings。"
    },
    {
      "type": "heading",
      "text": "实际目录树",
      "level": 2
    },
    {
      "type": "text",
      "md": "从本次工作树读取的真实文件与行数；四个 mod.rs 保持简短，探测 mod.rs 还包含契约与通用结果。"
    },
    {
      "type": "code",
      "lang": "text",
      "text": "src/\n  routing/\n    attempt.rs  (84 lines)\n    classify.rs  (22 lines)\n    config.rs  (139 lines)\n    filter.rs  (17 lines)\n    mod.rs  (13 lines)\n    select.rs  (86 lines)\n    tests.rs  (337 lines)\n  outbound/\n    direct.rs  (133 lines)\n    mod.rs  (12 lines)\n    registry.rs  (232 lines)\n    reverse.rs  (92 lines)\n    tunnel.rs  (1038 lines)\n  health/\n    mod.rs  (7 lines)\n    outcome.rs  (89 lines)\n    state.rs  (136 lines)\n  probe/\n    mod.rs  (32 lines)\n    runner.rs  (30 lines)\n    scheduler.rs  (81 lines)\n    tcp.rs  (19 lines)\n    tests.rs  (145 lines)\n"
    },
    {
      "type": "heading",
      "text": "设计职责 → 原位置 → 新位置",
      "level": 2
    },
    {
      "type": "list",
      "items": [
        "**候选归一化与固定 backend 层级**\n\n原位置：routing.rs · Registry::prepare 的 specs、child、endpoint\n\n新位置：routing/config.rs · normalize、Route、Tier",
        "**业务与协议、下载识别**\n\n原位置：routing.rs · Traffic、download\n\n新位置：routing/classify.rs · Traffic、download",
        "**候选资格过滤**\n\n原位置：routing.rs · Health::usable\n\n新位置：routing/filter.rs · allows；本次排除集仍由 select 使用",
        "**固定层级、同层选择与规划**\n\n原位置：routing.rs · Planner::select、Registry::select\n\n新位置：routing/select.rs · Planner::select、select；registry/get 只按编号取实例",
        "**一次业务预算与尝试边界**\n\n原位置：routing.rs · Attempt、Executor、AttemptLoop、StreamExecutor\n\n新位置：routing/attempt.rs · 原执行循环与共享 deadline",
        "**反代公共能力与 backend 差异**\n\n原位置：outbound.rs · ReverseBackend、ReverseProxy；http_proxy.rs · http_route\n\n新位置：outbound/reverse.rs · 原能力策略与 SNI/authority/endpoint 映射；HTTP 栈继续复用 http_proxy.rs",
        "**业务直连与地址历史**\n\n原位置：outbound.rs · DirectOutbound、AddressHealth\n\n新位置：outbound/direct.rs · 原连接实现与按 generation 的历史",
        "**已有隧道适配与资源**\n\n原位置：backend.rs · Forward、XHTTP carrier、TLS、隧道准备/连接/排空\n\n新位置：outbound/tunnel.rs · TunnelOutbound 持有原状态；原协议实现与相关测试整体随迁",
        "**出口实例、池资源与按编号取得**\n\n原位置：routing.rs · Registry；outbound.rs · SocketBridge；backend.rs 的每出口池\n\n新位置：outbound/registry.rs · Registry/get、SocketBridge；Registry 持有每出口 Backend，既有 HTTP 池继续由对应 Backend 持有",
        "**健康记录、统计、两态、恢复与冷却**\n\n原位置：routing.rs · Eligibility、Health、record/record_at、健康更新\n\n新位置：health/state.rs · 原记录与转换、record_outcome、access_success",
        "**结果归因**\n\n原位置：routing.rs · OutcomeClassifier、BeforeCommit、target_connection、failure_at\n\n新位置：health/outcome.rs · 原重试归因、target_connection、classify_failure；状态修改交给 state",
        "**独立探测契约和通用结果**\n\n原位置：probe.rs · Probe、SocketEndpoint、ProbeResult\n\n新位置：probe/mod.rs · 原契约和结果类型",
        "**只连接接入点的 TCP 探测**\n\n原位置：probe.rs · TcpProbe\n\n新位置：probe/tcp.rs · 原探测实现",
        "**探测 deadline、取消与受控执行**\n\n原位置：probe.rs · ProbeRunner\n\n新位置：probe/runner.rs · 原超时与取消包装",
        "**调度、并发与去重**\n\n原位置：probe.rs · ProbeScheduler；routing.rs · 周期检查与接入点分组\n\n新位置：probe/scheduler.rs · 原并发执行、maintain 周期、group_targets 去重；到期/退避仍沿用同一健康记录",
        "**生命周期、启动与反馈组装**\n\n原位置：native_plane.rs 生命周期；routing.rs · Registry::prepare/check\n\n新位置：native_plane.rs · 原生命周期、prepare_routes/check_routes；组装出口与独立探测反馈"
      ]
    },
    {
      "type": "heading",
      "text": "静态检查",
      "level": 2
    },
    {
      "type": "text",
      "md": "真实默认特性静态编译输出摘要；`--tests` 仅编译测试目标，没有执行测试。完整输出随 artifact 保留在 cargo-check.txt。"
    },
    {
      "type": "code",
      "lang": "text",
      "text": "$ cargo check --offline --locked --tests\n    Checking steam-proxy v0.1.0 (__HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-5-12-sdk)\nwarning: `steam-proxy` (lib) generated 4 warnings\nwarning: `steam-proxy` (lib test) generated 7 warnings (1 duplicate) (run `cargo fix --lib -p steam-proxy --tests` to apply 3 suggestions)\n    Finished `dev` profile [unoptimized + debuginfo] target(s) in 6.77s"
    },
    {
      "type": "text",
      "md": "本次格式、差异及源码核对的真实输出；源码核对验证现有测试主体未删改，仅允许空白与迁移后的内部路径变化。"
    },
    {
      "type": "code",
      "lang": "text",
      "text": "$ cargo fmt --all -- --check\nexit=0\n\n$ git diff --check 681da851d484d7fe5b7026e86e42db2b7ab85b32 HEAD\nexit=0\n\n$ python3 /private/tmp/sps5_static_audit.py\nexit=0\nExisting inline tests: 92 before / 92 after.\nAll existing inline test bodies match, allowing whitespace and moved internal paths only.\nPublic configuration, mode types and lifecycle implementation are unchanged.\nAll 18 required module files exist; flat-file conflicts are absent; mod.rs files stay small.\nProbe sources do not reference business Route, Backend or Outbound types.\nTracked changes are restricted to Rust src/**.\n\nActual directory tree:\nsrc/routing/\n  attempt.rs (84 lines)\n  classify.rs (22 lines)\n  config.rs (139 lines)\n  filter.rs (17 lines)\n  mod.rs (13 lines)\n  select.rs (86 lines)\n  tests.rs (337 lines)\nsrc/outbound/\n  direct.rs (133 lines)\n  mod.rs (12 lines)\n  registry.rs (232 lines)\n  reverse.rs (92 lines)\n  tunnel.rs (1038 lines)\nsrc/health/\n  mod.rs (7 lines)\n  outcome.rs (89 lines)\n  state.rs (136 lines)\nsrc/probe/\n  mod.rs (32 lines)\n  runner.rs (30 lines)\n  scheduler.rs (81 lines)\n  tcp.rs (19 lines)\n  tests.rs (145 lines)\n"
    },
    {
      "type": "heading",
      "text": "独立结构评审",
      "level": 2
    },
    {
      "type": "text",
      "md": "指定 Codex auto/gpt-6-astra、medium 的唯一正式评审结论；已通过 herdr-task reviewed 记录在本次最终提交。"
    },
    {
      "type": "code",
      "lang": "text",
      "text": "Reviewed SHA acadc79404e32fe5ef5e787cf9816523e6fa6631 using git diff dev...acadc79404e32fe5ef5e787cf9816523e6fa6631. The generated diff matches /private/tmp/sps5-review.diff.\n\nNo findings — no blocker, major, or minor issues identified within the requested scope: required directory responsibilities, dependency direction, public export compatibility, and obvious behavior changes from extraction.\n\nRead the supplied compilation and static-audit evidence; independently confirmed git diff --check passes. No tests, runtime or language regressions, feature matrices, installs, downloads, or agents were run. No source or workflow state was changed.\n\nThis completes SPS-5’s single formal independent review round for the SHA above."
    },
    {
      "type": "heading",
      "text": "Not proven",
      "level": 2
    },
    {
      "type": "list",
      "items": [
        "按用户规则未运行 dev 回归：未执行 cargo test、运行时或语言回归、race、特性矩阵。",
        "未验证 Steam 真实请求、设备网络、吞吐、TLS/池运行表现；静态编译不能证明这些运行行为。",
        "未编译完整可选特性矩阵，未安装工具链或下载、升级依赖。",
        "整个原设计的全部功能验收不在本任务结论内。",
        "未合并 dev 或 main，未 Accept/Done、创建 tag 或部署。"
      ]
    }
  ]
};
