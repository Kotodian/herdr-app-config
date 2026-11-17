// Written by herdr-artifact from recipe.json.
export default {
  "recipe": 1,
  "blocks": [
    {
      "type": "text",
      "md": "直连地址的来源、排序和反馈可以替换，HTTP 与 TCP 都已接入。\n宿主可以读取近期探测窗口和真实业务诊断；缺少真实测量的指标明确保留限制。\n开发阶段只编译测试源码，没有运行行为验收。"
    },
    {
      "type": "stats",
      "items": [
        {
          "label": "允许检查",
          "value": "5/5",
          "note": "真实命令退出码"
        },
        {
          "label": "行为测试",
          "value": "未执行",
          "note": "留待 main 阶段"
        },
        {
          "label": "正式评审",
          "value": "进行中",
          "note": "唯一一轮，同一 reviewer"
        }
      ]
    },
    {
      "type": "text",
      "md": "证据一：本次实际提交与基线（完整 patch、逐文件哈希和检查日志随 proof 留存）。"
    },
    {
      "type": "code",
      "lang": "text",
      "text": "candidate 9e1719f3997bb527b91bfdec84b99d795356e779\nbase      3861d8c332b5269b3b112ee17a048ce3b5a254c0\nbranch    task/9-task → dev\nObsidian original == 20261115 snapshot: True\noriginal sha256 cd324267f177fbee62854bac346344b6dab48bf64d099116728b9645573b29c2\ntests_executed: false"
    },
    {
      "type": "text",
      "md": "证据二：最终候选上的真实检查命令；通过仅表示编译与格式正确。"
    },
    {
      "type": "table",
      "columns": [
        "检查",
        "退出码",
        "范围"
      ],
      "rows": [
        [
          "cargo-check",
          "0",
          "离线 Rust 测试源码编译"
        ],
        [
          "cargo-fmt",
          "0",
          "格式或 diff"
        ],
        [
          "go-compile",
          "0",
          "Go 测试源码编译，不执行 init"
        ],
        [
          "go-format",
          "0",
          "格式或 diff"
        ],
        [
          "diff-check",
          "0",
          "格式或 diff"
        ]
      ]
    },
    {
      "type": "details",
      "summary": "cargo-check · 原始命令与输出",
      "blocks": [
        {
          "type": "text",
          "md": "运行目录：`__HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-9-task`；耗时 21.52 秒。"
        },
        {
          "type": "code",
          "lang": "text",
          "text": " cargo check --offline --locked --tests\nexit_code=0\n   Compiling aws-lc-sys v0.45.0\n   Compiling ring v0.17.14\n   Compiling zstd-sys v2.1.2+zstd.1.5.7\n   Compiling zstd-safe v8.2.0\n    Checking zstd v0.14.3\n    Checking x509-parser v0.18.1\n    Checking pingora-header-serde v0.9.1\n    Checking rcgen v0.14.10\n   Compiling aws-lc-rs v1.18.1\n   Compiling rustls v0.23.40 (https://github.com/aimalygin/shaped-rustls?rev=3a131beaef0183b0cb61e5a9070a703b6be39ed3#3a131bea)\n    Checking rustls-webpki v0.103.16\n    Checking xray-proxy v0.9.0 (https://github.com/aimalygin/xray-rust?rev=0cabb69b85214b959033e74c542408585bbbe4e8#0cabb69b)\n    Checking xray-vless-encryption v0.9.0 (https://github.com/aimalygin/xray-rust?rev=0cabb69b85214b959033e74c542408585bbbe4e8#0cabb69b)\n    Checking tokio-rustls v0.26.6\n    Checking quinn-proto v0.11.16 (https://github.com/aimalygin/xray-rust?rev=0cabb69b85214b959033e74c542408585bbbe4e8#0cabb69b)\n    Checking pingora-rustls v0.9.1\n    Checking pingora-core v0.9.1\n    Checking quinn v0.11.9 (https://github.com/aimalygin/xray-rust?rev=0cabb69b85214b959033e74c542408585bbbe4e8#0cabb69b)\n    Checking h3-quinn v0.0.10 (https://github.com/aimalygin/xray-rust?rev=0cabb69b85214b959033e74c542408585bbbe4e8#0cabb69b)\n    Checking xray-transport v0.9.0 (https://github.com/aimalygin/xray-rust?rev=0cabb69b85214b959033e74c542408585bbbe4e8#0cabb69b)\n    Checking pingora-cache v0.9.1\n    Checking pingora-proxy v0.9.1\n    Checking steam-proxy v0.1.0 (__HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-9-task)\nwarning: unused imports: `DiagnosticRecorder`, `Kind`, and `ObservationContext`\n --> src/inspection_tests.rs:2:13\n  |\n2 | use crate::{DiagnosticRecorder, Kind, ObservationContext};\n  |             ^^^^^^^^^^^^^^^^^^  ^^^^  ^^^^^^^^^^^^^^^^^^\n  |\n  = note: `#[warn(unused_imports)]` (part of `#[warn(unused)]`) on by default\n\nwarning: unused import: `bytes::Bytes`\n --> src/inspection_tests.rs:3:5\n  |\n3 | use bytes::Bytes;\n  |     ^^^^^^^^^^^^\n\nwarning: unused import: `sync::Arc`\n --> src/inspection_tests.rs:4:34\n  |\n4 | use std::{collections::BTreeMap, sync::Arc};\n  |                                  ^^^^^^^^^\n\nwarning: method `record` is never used\n  --> src/health/state.rs:86:19\n   |\n32 | impl Health {\n   | ----------- method in this implementation\n...\n86 |     pub(crate) fn record(&mut self, result: &Result<Duration>, startup: bool, generation: u64) {\n   |                   ^^^^^^\n   |\n   = note: `#[warn(dead_code)]` (part of `#[warn(unused)]`) on by default\n\nwarning: method `matches` is never used\n   --> src/inspection.rs:135:19\n    |\n134 | impl ClientIpRule {\n    | ----------------- method in this implementation\n135 |     pub(crate) fn matches(&self, host: &str, path: &str) -> bool {\n    |                   ^^^^^^^\n\nwarning: associated function `new` is never used\n  --> src/outbound/registry.rs:61:19\n   |\n60 | impl Registry {\n   | ------------- associated function in this implementation\n61 |     pub(crate) fn new(routes: Vec<Route>, generation: u64) -> Arc<Self> {\n   |                   ^^^\n\nwarning: method `child` is never used\n  --> src/managed_stream.rs:38:12\n   |\n36 | impl Connections {\n   | ---------------- method in this implementation\n37 |     #[cfg(feature = \"reverse-proxy\")]\n38 |     pub fn child(self: &Arc<Self>) -> crate::Result<Arc<Self>> {\n   |            ^^^^^\n\nwarning: fields `cipher` and `password` are never read\n  --> src/tunnel_url.rs:16:16\n   |\n12 | pub struct ShadowsocksUrl {\n   |            -------------- fields in this struct\n...\n16 |     pub(crate) cipher: String,\n   |                ^^^^^^\n17 |     pub(crate) password: Zeroizing<String>,\n   |                ^^^^^^^^\n   |\n   = note: `ShadowsocksUrl` has a derived impl for the trait `Clone`, but this is intentionally ignored during dead code analysis\n\nwarning: field `path` is never read\n  --> src/tunnel_url.rs:25:16\n   |\n21 | pub struct WebSocketUrl {\n   |            ------------ field in this struct\n...\n25 |     pub(crate) path: String,\n   |                ^^^^\n   |\n   = note: `WebSocketUrl` has a derived impl for the trait `Clone`, but this is intentionally ignored during dead code analysis\n\nwarning: `steam-proxy` (lib) generated 6 warnings\nwarning: variants `CacheSlow`, `CacheSized`, `CacheVary`, and `CacheRange` are never constructed\n   --> src/http_proxy_tests.rs:163:5\n    |\n159 | enum ResponseMode {\n    |      ------------ variants in this enum\n...\n163 |     CacheSlow,\n    |     ^^^^^^^^^\n...\n172 |     CacheSized,\n    |     ^^^^^^^^^^\n...\n176 |     CacheVary,\n    |     ^^^^^^^^^\n177 |     CacheRange,\n    |     ^^^^^^^^^^\n    |\n    = note: `ResponseMode` has a derived impl for the trait `Clone`, but this is intentionally ignored during dead code analysis\n    = note: `#[warn(dead_code)]` (part of `#[warn(unused)]`) on by default\n\nwarning: field `cipher` is never read\n  --> src/tunnel_url.rs:16:16\n   |\n12 | pub struct ShadowsocksUrl {\n   |            -------------- field in this struct\n...\n16 |     pub(crate) cipher: String,\n   |                ^^^^^^\n   |\n   = note: `ShadowsocksUrl` has a derived impl for the trait `Clone`, but this is intentionally ignored during dead code analysis\n\nwarning: `steam-proxy` (lib test) generated 7 warnings (2 duplicates) (run `cargo fix --lib -p steam-proxy --tests` to apply 3 suggestions)\n    Finished `dev` profile [unoptimized + debuginfo] target(s) in 21.49s\n"
        }
      ]
    },
    {
      "type": "details",
      "summary": "cargo-fmt · 原始命令与输出",
      "blocks": [
        {
          "type": "text",
          "md": "运行目录：`__HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-9-task`；耗时 0.22 秒。"
        },
        {
          "type": "code",
          "lang": "text",
          "text": " cargo fmt --all -- --check\nexit_code=0\n(无输出)"
        }
      ]
    },
    {
      "type": "details",
      "summary": "go-compile · 原始命令与输出",
      "blocks": [
        {
          "type": "text",
          "md": "运行目录：`__HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-9-task/bindings/go`；耗时 1.26 秒。"
        },
        {
          "type": "code",
          "lang": "text",
          "text": "GOWORK=off CGO_ENABLED=0 go test -c -o /private/tmp/sps9-go.test .\nexit_code=0\n(无输出)"
        }
      ]
    },
    {
      "type": "details",
      "summary": "go-format · 原始命令与输出",
      "blocks": [
        {
          "type": "text",
          "md": "运行目录：`__HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-9-task`；耗时 0.01 秒。"
        },
        {
          "type": "code",
          "lang": "text",
          "text": " gofmt -l __HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-9-task/bindings/go/diagnostics.go __HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-9-task/bindings/go/diagnostics_http_test.go __HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-9-task/bindings/go/diagnostics_test.go __HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-9-task/bindings/go/direct.go __HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-9-task/bindings/go/direct_test.go __HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-9-task/bindings/go/http.go __HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-9-task/bindings/go/mode.go __HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-9-task/bindings/go/pool.go __HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-9-task/bindings/go/routing.go\nexit_code=0\n(无输出)"
        }
      ]
    },
    {
      "type": "details",
      "summary": "diff-check · 原始命令与输出",
      "blocks": [
        {
          "type": "text",
          "md": "运行目录：`__HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-9-task`；耗时 0.02 秒。"
        },
        {
          "type": "code",
          "lang": "text",
          "text": " git diff --check dev...HEAD\nexit_code=0\n(无输出)"
        }
      ]
    },
    {
      "type": "text",
      "md": "证据三：唯一正式 reviewer 的原始报告；受审 SHA 须与上方候选一致。"
    },
    {
      "type": "details",
      "summary": "独立只读评审报告",
      "blocks": [
        {
          "type": "code",
          "lang": "text",
          "text": "唯一正式只读评审正在进行；尚未声称评审通过。"
        }
      ]
    },
    {
      "type": "text",
      "md": "证据四：本次逐章核对的生产调用链、23 个场景和明确能力限制。"
    },
    {
      "type": "details",
      "summary": "完整设计与验收台账",
      "blocks": [
        {
          "type": "text",
          "md": "# SPS-9 设计、源码与验收台账\n\n核对日期：2026-11-17。范围：剩余直连地址策略和本地诊断消费链，保留 SPS-1～8 实现。\n此台账不表示全设计运行验收完成。\n\n## 基线与来源\n\n- 工作分支 task/9-task，开发目标 dev；起始 dev 为 `3861d8c332b5269b3b112ee17a048ce3b5a254c0`（SPS-8 PR #8 squash 合入）。\n- 已核对 `67145a825b263e47a2953c2e94d7fb65bed62fb2` 到 dev 的实际源码差异：仅 Go 网络观察按编译目标拆为五个文件，是 SPS-8 人工返修；启动预算、HTTP 提交、H2 写锁修正均在 dev。不能用 squash 后不具有旧 SHA 祖先关系来否定合入结果。\n- SPS-6 Planner 为 `d8ca233`，SPS-7 出口组合为 `24707ae`，均在 dev 历史；本任务不重新实现。\n- 通过 Obsidian CLI 读取 `gamesir/需求/steam 加速/方案/Steam 商店加速-SDK路由与策略引擎设计.md`，与 `/private/tmp/steam-sdk-routing-design-20261115.md` 逐字节一致。\n- 已读 SPS-8 `/private/tmp/sps8-proof/ledger.md`、checks-summary.json、review.txt；proof `go-proof-81f9`。其检查候选 `19335d7` 与唯一模型评审 `67145a8` 明确不同，后续人工返修不冒称模型已审。\n- 已读 RTK.md；工作树及适用父目录未找到额外 AGENTS.md/CLAUDE.md 文件。Makefile 的绑定构建不是本轮允许的验证命令，未运行。\n\n状态术语：\n\n| 标记 | 严格含义 |\n| --- | --- |\n| 源码 | 已追踪生产调用链，或有对应测试源码；不等于运行通过 |\n| 编译 | 仅获授权命令实际通过，最终 SHA、命令和日志由本任务 proof 绑定 |\n| main 待验收 | 有实现但运行效果、并发、平台或真实节点尚未运行 |\n| 不支持 | 已确认缺少该能力，不会靠未来运行检查自动变成已支持 |\n| 未核实 | 当前证据不足，列出具体边界，不泛称实现缺失 |\n\n本任务所有 Rust/Go 新旧测试均未执行；没有测试 binary/init、race、feature 矩阵、\n设备、真实节点或 Steam 请求。新旧代码的对比是源码事实，不冒充失败→通过的行为复现。\n正式评审报告和真实最终 SHA 放在 proof，不以预填 SHA 或此前评审替代。\n\n## 本次实际改动\n\n### 地址组合\n\n原文 §2：“DirectOutbound<S> … 候选地址来源与地址选择策略”；§10：“从真实业务需要的候选地址中选择”；\n§11：“解析或读取候选 → 优先使用历史表现好的地址 → 在允许的建连失败边界尝试其他地址 → 记录本次结果”。\n\n起点事实：Rust S 是 TcpDialer，connect_addresses 内部固定排序；Go 有 Resolver，排序仍在 dialRoute 内。\n本次新增 Rust DirectAddressStrategy（resolve/order/feedback）与 HistoricalAddresses，\nS 是策略，dialer 独立。通过带默认实现的 TcpDialer::direct_addresses 接入 Native 组装，\n不增加 Dependencies 必填字段。Go 保留 Resolver，通过可选 DirectAddressProvider 取得策略，\n与 Dialer 原接口兼容。\n\n生产链：Rust build_routes → Backend::create_in_generation → NativeStream/NativeHttp →\nDirectOutbound → 地址策略 → 实际拨号 → 本代历史/反馈。HTTP 新建连接也使用策略来源；\n池命中不额外解析。Go Create/prepareRoutes → Connect 或 Request → connectRoute/dialRoute →\nResolver/Order → 真实拨号 → 当前代反馈。策略不在健康锁内执行。\n\n默认按失败数和真实成功耗时稳定排序，不后台测原站、不追加 TLS/HTTP 验证。\n地址轮换仍在已有执行器同一 deadline 与取消边界内，既有 SNI/authority 和提交后不重放保持。\nRust 每代新对象，Go 每代 route.direct；自定义共享策略收到 generation，必须自行隔离其私有历史。\n\n测试源码：\n\n- Rust `replacement_strategy_is_wired_through_native_tcp_and_http_executors`：替代来源/逆序/反馈必须经过 Native routes 组装和两种执行器；C 启动没有业务拨号。\n- Rust `direct_addresses_only_learn_from_business_and_history_is_per_generation`、`address_failover_shares_executor_deadline_and_cancellation`。\n- Go `TestReplacementAddressStrategyThroughFactoryConnect`、`TestHistoricalAddressOrderAndGenerationIsolation`、`TestAddressFailoverUsesOneBudgetAndStopsOnCancellation`。\n- Go `TestBusinessDiagnosticsFromRealHTTPReuseAndInterruptedBody` 同时断言 HTTP 使用替代策略且复用不重拨。\n\n### 探测窗口和宿主消费\n\n原文 §6.3：“最近 60 秒成功次数 / 完成次数，失败与超时进入分母，取消单列”；\n“诊断与后续阈值验证；少量启动样本不做百分比熔断”。\n\n起点有 60 秒、最多 256 条完成样本和单列累计取消，但 Rust Observer/Go Status 都不能消费窗口。\n本次保留生产 Health/accessHealth 写入链，增加各最多 256 条的近期取消队列；\n完成/成功和取消按读取时刻过滤，容量逐出显式 truncated，零分母 None/nil。\nRust Observer 兼容默认回调交付 Weak Registry-backed source，DiagnosticRecorder.snapshot.probes 读取当前代；\nGo Mode.Diagnostics 直接复制当前代 accessHealth。重复接入地址按线路编号分组合并，不重计。\nC-only 返回空接入点列表，没有原站样本。读窗口不会影响熔断或同层选择。\n\n真实写入仍是 Rust check_routes_until → ProbeResult.completed → Health.record_at，\nGo probeBatch/probeLoop → recordProbe。业务 record_outcome/record 不写探测样本，\n取消不进入 completed，旧代反馈不污染新代。网络失效时 Rust source 返回 None，\n发布后读取新 Registry；Go 锁内读取 current session/routes。\n\n测试源码：Rust `diagnostics_read_expires_without_new_feedback_and_reports_truncation`、\n`recorder_reads_live_deduplicated_probe_windows_and_new_generation`；\nGo `TestDiagnosticsWindowReadExpiryZeroSamplesAndDeduplication`、\n`TestBusinessDiagnosticsBoundedAndOldGenerationDoesNotPolluteCurrent`。\n已有 recent_probe_window / TestRecentProbeWindowCancellationAndBusinessSeparation 保留。\n\n### 业务诊断\n\n原文 §6.3：“首字节、正文吞吐与中断 … 真实业务，缓存命中与连接复用单列”；\n“首版不拿不同目标、响应大小的样本直接排名”。\n\nRust 现有生产链已完整的部分不重做：ObservedStream → UpstreamFirstByte，\nPingora HttpHeaders、HttpBody、HttpCacheHit、HttpReuse/Http2Reuse → Observer →\nDiagnosticRecorder events/metrics/resources。缓存路径不混作上游正文，\n被动字节流首字节可能是 TLS 记录，不是 HTTP TTFB。\n已有资源/缓存/复用测试保留；memory/disk cache 条件测试不在默认 feature 编译覆盖之内。\n\nGo 起点没有对应业务诊断消费链。本次 Request 在真实提交后开始计时，\nHTTP/1 reader.Peek(1)、HTTP/2 固定依赖 trace 记录响应边界，\npool.take 实际命中标记单次复用，responseBody.Read/Close 记录真实正文 bytes/elapsed、\nEOF、错误、提前关闭。Mode.Diagnostics.Business 返回最近 60 秒内最多 256 条记录，\n带 route/generation/protocol，不含 URL/正文；旧代迟到事件不进入当前代。\n没有缓存实现，CacheAvailable=false，不能声称命中率为零。\n\n准确限制：Rust 精确逐 HTTP 请求首字节尚未支持，只有完整响应头耗时和字节流首字节；\nGo HTTP/2 trace 的真实边界是首个完整 HEADERS，显式 FirstByteBoundary=http2-response-headers，\n不是线上首字节；Go 原始 TCP 首字节/吞吐诊断尚未支持。\n正文数据是被动原始观测，未新增自动吞吐值、RTT、IP 丢包率或跨目标评分。\n无需真实节点的读法和具体口径见 diagnostics.md。\n\n## 剩余歧义的处置\n\n| 项目与原文 | 实际调用链/依据 | 结论 |\n| --- | --- | --- |\n| §6.2“全局并发上限 3”，§7“探测并发 3” | Rust 每次本实例检查创建 ProbeScheduler/Semaphore，维护任务串行等待旧探测后换代；Go 每 session probeLoop 的 inflight/worker 上限 3，startup runner 同上 | 全部本实例接入点共用 3；不是每节点 3。原文未说明多个 SDK 实例是否要共享进程配额。跨实例进程上限未实现；不擅自加全局状态 |\n| §2“EdgeOneWebSocket … TCP 载荷 backend”，§3“沿用现有入口” | Rust RemoteBackend::payload 与 normalize 按能力过滤；Go RemoteBackend 原本没有该枚举/反代配置，Forward 的 WSS 是另一条能力 | Rust 依 websocket feature 支持 TCP；Go 此反代 backend 不支持。不能把 WSS tunnel 当作它；本任务不扩 wire |\n| §8“网络变化时使旧网络测量失效”与开篇“宿主继续负责…系统设置” | Rust network_change::revision，Go 按编译目标选 localNetworkRevision；已有 dialer network_revision/NetworkObserver 优先 | Linux/macOS 默认轮询部分本机字段；不保证所有网络变化。其他平台需宿主源；不重写平台适配 |\n| §8“高优先级…新请求…选回；已有连接继续使用原出口” | Planner 仍每次按固定层级；HTTP RequestContext/Go responseBody 持有旧连接；Registry active/route users 保护已有流 | 已有实现，新增真实本地 HTTP 流共存测试源码；未运行，归 main 待验收，不再以“完全无证据”列 D |\n\n网络观察细节：Rust Linux 读取 /proc/net/route、ipv6_route、if_inet6、fib_trie、\nresolv.conf；macOS 读取 route/ifconfig 稳定字段，不完整覆盖 DNS。\nGo Linux 读取接口/地址、路由、resolv.conf，macOS 接口/地址与默认网关。\n同网关同地址 Wi-Fi 切换、所有 VPN/DNS 变化、轮询间瞬变均不保证检测。\nGo Android/iOS 显式走无默认源的编译分支；Rust 只 Linux/macOS 有默认源。\n读取失败保留上次身份，宿主源必须可取消且不连接业务目标。\n\n共存测试新增：\nRust `recovered_higher_tier_serves_new_http_while_lower_tier_body_survives`，\nGo `TestRecoveredHigherTierKeepsLowerTierResponseAlive`。\n均通过健康反馈入口注入两次成功，再经过真实 HTTP 调用观察 A 恢复后新请求走 A，\n原 B 正文仍可消费；不冒称已验证真实节点恢复探测或设备无损切换。\n\n## 全章节核对\n\n| 原文章节 | 当前源码事实 | 状态/未验收 |\n| --- | --- | --- |\n| §1 依据/宿主 | Factory/生命周期/原始目标交付保留，独立 Go 实现 | 源码；宿主设备 main 待验收 |\n| §2 能力/层级 | 统一反代、C 地址策略、D 隧道、A→B→C→D 与载荷/下载过滤 | 源码；Go EdgeOneWebSocket 不支持 |\n| §3 配置 | 原 Routes/ModeConfig、Factory 与白名单，不新增 wire 字段 | 源码；跨语言设备 main 待验收 |\n| §4 职责 | native 组装，routing 选路/预算，outbound 连接/资源，health 统计/归因，probe 独立 | 源码；未重做 Planner/出口栈 |\n| §5 状态/锁 | 健康短锁；地址策略用复制历史，回调不持锁；新诊断只读副本 | 源码；并发 race main 待验收 |\n| §6/6.1 探测 | 仅接入点，拨号总成本；目标/业务不经 Probe | 源码；不是 RTT，真实节点 main 待验收 |\n| §6.2 调度 | 实例内上限 3、去重/3 秒/总预算/抖动/退避/恢复、旧代取消等待保留 | 源码；进程总限额未实现，原文作用域未明 |\n| §6.3 指标 | 新增窗口消费和 Go 业务诊断，Rust 原事件复用，不改排名 | 源码/编译；精确 HTTP 首字节与 Go TCP 诊断限制见上 |\n| §7 Start | 资源准备后统一资格，C 无原站探测、超时失败均汇总 | 源码；运行 main 待验收 |\n| §8 健康/恢复/网络 | 业务隔离/目标冷却不被 probe 清除，网络代际防迟到，新旧流持有分离 | 源码；新共存测试仅编译，真实网络 main 待验收 |\n| §9 Restart | 旧 close 等待，fresh Inner/session，旧 clone 不转向、失败保留状态 | 源码；本轮未改，运行 main 待验收 |\n| §10 组合/池 | S 已是真实地址策略；Native HTTP/TCP 接入；SNI/authority/ALPN/connector/generation 隔离 | 源码/编译；协议矩阵 main 待验收 |\n| §11 预算/提交 | 地址轮换共享 deadline/取消；可能提交后不跨候选重放 | 源码/编译；新旧竞态 main 待验收 |\n| §12 落点/验收 | 原 routing/outbound/health/probe 布局，全部 23 场景逐项列在下表 | 源码/编译不是全设计验收 |\n\n## 第 12 节全部 23 个场景\n\n下表测试名称为源码索引。默认 feature 内 Rust/Go 测试源码只编译；\n条件 feature 测试不表示本轮已编译该分支，更不表示已运行。\n\n| # | 原文场景 | 实现/测试源码依据 | 未完成验收 |\n| --- | --- | --- | --- |\n| 1 | Relay/CDN 同配，A 优先 B | reverse 统一流程，fixed_tiers_exhaust_same_tier_and_hash_is_stable / TestPlannerFixedTierAndSameTierFallback | main 运行 |\n| 2 | A1 失败先 A2，B 更快 | Planner/Attempt tried，同上及 routed_h2_selects_per_request_exhausts_relays_and_isolates_upstream_pools | main 运行 |\n| 3 | A1 40/A2 45/B10，稳定同层 | failure_count_then_twenty_percent_window_then_capability_filter / TestPlannerFailurePreferenceLatencyAndCapabilities | main 运行 |\n| 4 | 慢 DNS/dialer 轮换计入成本 | TcpProbe 从调用前计时，ProbeResult.completed；窗口不标 RTT | 专门慢 DNS 组合运行未核实，main 补验 |\n| 5 | 单次失败偏好、连续阈值 | health_ewma_recovery_backoff_expiry_and_generation / TestAccessHealthIsolationBackoffRecoveryAndEWMA | main 运行 |\n| 6 | A 不可用按 B/C/D | 固定层级、能力过滤和共享 Attempt | main 运行/协议矩阵 |\n| 7 | TCP 遇 HTTP backend | normalize/filter，edgeone_websocket_is_filtered_from_http_candidates_before_probing / TestDownloadEligibilityUsesBackendCapability | Go EdgeOneWebSocket 反代不支持；其余 main 运行 |\n| 8 | Start 部分超时 | startup_budget_settles_slow_remotes_and_keeps_local_direct_available / TestStartupBudgetAndCancellationWaitForAllProbes | main 运行 |\n| 9 | 只 C 不探原站 | direct_only_start_never_connects_origin_and_close_stops_pending_calls / TestDirectOnlyStartAndBackgroundNeverDialOrigin；本次替换策略用例 | main 运行 |\n| 10 | 所有候选无资格 | startup_collects_failed_and_good_candidates_and_rejects_all_failed / TestStartupRejectsAllInaccessibleLegacyRoutes | main 运行 |\n| 11 | 反代/隧道只探接入 | tcp_probe_only_opens_access_socket_and_closes_without_writing / TestStartupAccessQualificationBeforeRunning | main 运行，真实节点未测 |\n| 12 | 全业务出口拒绝仍能 probe | startup_probe_works_with_every_http_and_stream_outlet_replaced_by_refusal，Probe 不导入业务出口 | main 运行 |\n| 13 | TCP 成功不清凭据/429 | outcome Isolate/Target 分离、inherit；HTTP no-replay/health 测试保留 | main 运行 |\n| 14 | 冷却/C 地址/网络变化不主动测 Steam | 地址策略 per-generation；native_network_event_keeps_committed_stream_resets_history_and_stops_subscription / TestNetworkChangeDirectOnlyKeepsStreamAndClearsHistoryAndStopsObserver | main 运行；默认源限制保留 |\n| 15 | 高优先级恢复，新旧流并存 | 本次 recovered_higher_tier_serves_new_http_while_lower_tier_body_survives / TestRecoveredHigherTierKeepsLowerTierResponseAlive | 测试只编译，真实恢复/流共存 main 运行 |\n| 16 | 用户选 B1 restart | restart_validates_first_and_keeps_old_handle_when_close_fails / TestRestartValidationFailurePreservesOldSession | main 运行/宿主交接 |\n| 17 | Closed 要新 Mode | restart_replaces_inner_and_old_clones_remain_closed_on_success_and_failure / TestRestartFreshSessionClosesOldConnections | main 运行 |\n| 18 | 重启旧流结束不重放 | 原生命周期 close-before-start，旧 clone/session 保留关闭含义 | main 运行/设备 |\n| 19 | 新 start 失败或 close 未完 | TestRestartCloseFailureDoesNotStartReplacement / TestRestartNewStartFailureAndCancellation；Rust 对应 lifecycle 用例 | main 运行 |\n| 20 | 可能已发送后不重放 | attempt_loop_shares_deadline_across_candidates_and_stops_after_commit；HTTP commitment；TestHTTPPoolReuseAndNoReplayAfterCommit | main 运行/竞态 |\n| 21 | Planner 无网络 | injected_filter_and_selector_borrow_candidates_with_fixed_tier_order；Go plannerFixture 测试 | main 运行 |\n| 22 | 原配置/语言绑定 | Dependencies 字段与 wire/ABI 不变；Rust 默认 trait 方法、可选诊断 JSON；Go 可选 provider 和新读取方法 | 编译本任务默认目标；绑定/设备矩阵未运行 |\n| 23 | cancel/close 收敛 | cancel_drains_running_and_queued_probes；SPS-8 网络/池关闭用例；本次地址取消与弱诊断源 | main 运行/race/真实长载流 |\n\n## 交付边界\n\n允许检查：`cargo check --offline --locked --tests`、`cargo fmt --all -- --check`、\n`git diff --check`；Go 在 bindings/go 下 `GOWORK=off CGO_ENABLED=0 go test -c`，\n另核对改动 Go 文件格式。编译告警保留原始日志，不将告警误写成零。\n最终 proof 绑定真实 SHA、完整 patch、原文校验、检查日志、唯一正式 reviewer 报告和本台账。\n\n没有新增依赖、部署、进程全局配额、Go EdgeOneWebSocket wire、系统代理/CA 操作或平台重写。\n没有推送/合并 main、tag、部署、Accept/Done；PR 目标为 dev，人工审核决定接受与合并。\nNot proven：所有行为测试、竞态与 feature/跨语言/设备矩阵，真实节点/Steam，\n默认网络源真实 OS 效果、XHTTP 长流和恢复时无损，均留 main 阶段另行授权运行。\n"
        }
      ]
    },
    {
      "type": "details",
      "summary": "宿主读取示例与指标口径",
      "blocks": [
        {
          "type": "text",
          "md": "# 地址策略与本地诊断\n\n本地诊断不创建监控服务、后台原站测速或额外 HTTP 请求。\n开发阶段只编译测试源码；本文示例与测试没有在 dev 执行。\n\n## 地址策略\n\nRust `DirectOutbound<S>` 的 S 是 `DirectAddressStrategy`，底层 `TcpDialer` 独立保存：\n\n1. `resolve(dialer, domain, port)` 为真实业务提供地址，默认调用宿主 dialer 的解析能力。\n2. `order(domain, generation, &mut [DirectAddress])` 接收本代的地址历史快照。\n3. 每次已完成且未取消的 TCP 建连调用 `feedback`，带 domain、generation、IP:port 和真实耗时/错误。\n\nNativeFactory 通过既有 dialer 依赖的默认方法 `TcpDialer::direct_addresses()` 取得策略。\n宿主可覆盖此方法返回自定义策略，再沿原 `Dependencies::with_dialer` 注入；\n原 dialer 实现无需增加方法，默认仍为 `HistoricalAddresses`。\nTCP 经 NativeStream，HTTP 经 NativeHttp connector，均实际调用同一 DirectOutbound。\nHTTP 复用连接时不重新解析，新连接由策略提供地址；反代的原 DNS 缓存路径保持独立。\nTLS SNI、authority 和目标头仍由原域名映射确定。\n\nGo 沿用 `Dependencies.Resolver` 提供地址来源。宿主 Dialer 可额外实现小接口\n`DirectAddressProvider.DirectAddresses() DirectAddressStrategy`，替换 Order/Feedback；\n未实现或返回 nil 则为 HistoricalAddresses。Factory → prepareRoutes → connectRoute →\ndialRoute 同时服务 Connect 与 HTTP 新连接，没有强行复制 Rust 泛型。\n\n内建策略保留解析顺序作为初始顺序，稳定排序时先比较失败次数，\n再优先成功历史中耗时较好的地址，不建立新的评分算法。\nDNS、全部地址建连、TLS 和跨出口尝试仍共享既有执行器 deadline。\n仅 TCP 建连未发送业务数据时轮换地址，不因目标响应或正文失败重放。\n网络变化创建新代直连历史；旧对象迟到反馈不会写入新对象。\nGo 反馈也检查获取上下文、route 和 session generation。\n\n策略同步方法不在健康锁内调用，须快速、可并发调用；异步来源必须遵守取消。\n外部策略若自行保存历史，必须按传入 generation 隔离，不能把旧代反馈当成新网络测量。\n\n## 探测窗口\n\nRust 通过 Observer 的默认回调 `probe_diagnostics` 交付只读\n`Arc<dyn ProbeDiagnosticsSource>`，自定义 observer 可保留它并调用 snapshot。\n`DiagnosticRecorder::snapshot().probes` 和 `snapshot_if_changed` 已消费此入口。\n源通过弱引用读取当前 Registry，不延长实例资源寿命。\n读取时过滤过期样本，窗口过期或 generation 改变会更新 recorder revision。\nGo 使用 `Mode.Diagnostics()` 读取生产 probeBatch/probeLoop 写入的 accessHealth 副本，\n原 Status 字段与行为不变。\n\n| 字段 | 两种实现共用的含义 |\n| --- | --- |\n| generation / Generation | 当前网络代际，网络变化后重新开始 |\n| endpoints / Probes | 仅实际接入点；同地址共用探测的线路编号合并到 routes/Routes，不重复累计 |\n| completed / Completed | 读取时最近 60 秒内完成的成功、失败和超时 |\n| success / Success | 上述完成样本的成功数 |\n| canceled / Canceled | 独立的最近 60 秒取消数，不进入完成分母 |\n| success_rate / SuccessRate | success/completed；零分母为 None/nil，不是 0% |\n| truncated / Truncated | 窗口内样本因容量被逐出，计数仅代表保留样本 |\n| capacity_per_outcome / CapacityPerOutcome | 完成和取消各最多 256 条；成功为完成样本的子集 |\n\nC-only 的接入点列表为空，不生成原站测量。\nRust 没有注册源、实例已释放或当代已失效时 probes 为 None。\n读取不改变资格、选择或熔断；真实业务接入结果不进入探测窗口。\n诊断以线路编号关联宿主持有的配置，不输出带凭据节点 URL。\n\n## 业务指标与真实口径\n\n| 指标 | Rust 生产写入 → 消费 | Go 生产写入 → 消费 |\n| --- | --- | --- |\n| 首字节 | managed_stream::ObservedStream 首次写入后开始、首次读到字节结束的 UpstreamFirstByte → recorder events/metrics；可能是 TLS 记录 | Request 提交后开始；HTTP/1 在 reader 首次可读字节处采集，HTTP/2 用固定依赖的 GotFirstResponseByte 回调；FirstByteBoundary 标明 response-byte 或 http2-response-headers |\n| HTTP 响应头 | upstream_request_filter → upstream_response_filter 的 HttpHeaders；不是精确 HTTP 首字节 | Business 的 headers.Elapsed；交换失败也保留 interrupted 记录 |\n| 正文数据/中断 | upstream_response_filter 创建 HttpBody、response_body_filter 累计数据、logging/Operation Drop 结算 → events、metrics、resources.incomplete_body_bytes | responseBody.Read 计真实字节、EOF、错误，Close 结算 body 事件；提前关闭标 Interrupted |\n| 缓存 | request_cache_filter 的实际 cache-hit 回调 → HttpCacheHit 字节/耗时，与上游 HttpBody 分开 | 没有响应缓存，CacheAvailable=false；不表示命中率 0% |\n| 复用 | connected_to_upstream 的 reused → HttpReuse/Http2Reuse → recorder | pool.take 实际命中 → connectHTTP → Business.Reused；单次请求标记，不写入共享连接 |\n\nRust 精确逐请求 HTTP 首字节尚无可用采集边界，现有 Pingora 回调给的是完整响应头。\nGo 固定版本的 HTTP/2 trace 在完整首个 HEADERS 处理时调用，不能称作线上第一个字节；\n因此明确标为 http2-response-headers。Go 原始 TCP 首字节/字节吞吐诊断尚未实现。\n这些限制不通过用响应头或 TLS 握手耗时冒充缺失测量来销项。\n\nRust 业务 counters/resources 为会话累积，events 为最近 256 条事件，\n与新增的 60 秒探测窗口独立。默认不输出目标名，目标捕获沿原 opt-in。\nGo Business 为最近 60 秒内保留的最多 256 条 headers/body 记录，带出口编号、协议、代际，\n不包含 URL/正文。正文在调用方关闭 Body 时结算，活跃正文尚无最终观测。\n旧代正文仍能读取，但迟到记录不进入当前代诊断；Restart 的新句柄读取新 session。\n\n正文 bytes 与 elapsed 是被动业务数据，不是主动带宽测试或可跨目标排名的吞吐值；\n编码、缓存和客户端背压都会影响它们。dial_elapsed 是拨号总成本，不是 RTT；\n探测失败比例不是 IP 丢包率。没有合成未测量的 RTT、丢包率或吞吐指标。\n\n## 无需真实节点的示例\n\n以下 Rust C-only 示例无业务请求，接入点列表为空；没有在 dev 运行：\n\n```rust\nuse steam_proxy::{Config, Dependencies, DiagnosticRecorder, Factory, Payload, Routes, Whitelist};\nuse tokio_util::sync::CancellationToken;\n\nasync fn inspect_local() -> steam_proxy::Result<()> {\n    let recorder = DiagnosticRecorder::default();\n    let sdk = Factory::new(Dependencies::new().with_observer(recorder.clone()))\n        .create(Config::new(\"local\", Routes {\n            payload: Payload::Tcp,\n            reverse: vec![],\n            direct: true,\n            tunnel: vec![],\n        }.into(), Whitelist::steam()))?;\n    sdk.start(CancellationToken::new()).await?;\n    if let Some(probes) = recorder.snapshot().probes {\n        assert!(probes.endpoints.is_empty());\n    }\n    sdk.close().await\n}\n```\n\nGo Create 后可直接读取零样本，无须启动或连接：\n\n```go\nmode, err := steamproxy.NewFactory(steamproxy.Dependencies{}).Create(steamproxy.Config{\n    Routes: &steamproxy.Routes{Payload: steamproxy.PayloadTCP, Direct: true},\n    Whitelist: steamproxy.Whitelist{\"example.test\": \"example.test\"},\n})\nif err != nil { return err }\nsnapshot := mode.Diagnostics()\nfmt.Println(snapshot.Generation, len(snapshot.Probes), snapshot.CacheAvailable)\nreturn mode.Close()\n```\n\n真实业务只需在原 Request/Connect 调用后读取，无须附加测试请求。\n策略替换、Native HTTP/TCP 组装、窗口过期/去重/代际隔离与 Go 本地 HTTP 采集的测试源码\n均纳入本任务允许的编译检查；编译不代表行为运行通过。\n\n## 兼容范围\n\nDependencies 的原字段、配置 wire、Factory/start/serve/close/restart 和既有 Status 不改。\nRust TcpDialer、Observer 只增加带默认实现的方法，原实现仍可编译；\nGo DirectAddressProvider 是可选接口，原 Dialer 无需实现。\nRust DiagnosticSnapshot 的 serde 表示增加可选 probes；未注册源时省略，\n旧快照反序列化默认为 None。这是诊断 JSON 的增量扩展，不是配置 wire 或 C ABI 变化。\nGo Diagnostics 使用独立方法。没有为此修改 C/TS/Swift/Kotlin 绑定。\n"
        }
      ]
    },
    {
      "type": "details",
      "summary": "最终 SHA 与逐文件哈希、检查记录",
      "blocks": [
        {
          "type": "code",
          "lang": "json",
          "text": "{\n  \"candidate\": \"9e1719f3997bb527b91bfdec84b99d795356e779\",\n  \"base\": \"3861d8c332b5269b3b112ee17a048ce3b5a254c0\",\n  \"tests_executed\": false,\n  \"checks\": [\n    {\n      \"name\": \"cargo-check\",\n      \"command\": [\n        \"cargo\",\n        \"check\",\n        \"--offline\",\n        \"--locked\",\n        \"--tests\"\n      ],\n      \"cwd\": \"__HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-9-task\",\n      \"exit_code\": 0,\n      \"passed\": true,\n      \"elapsed_seconds\": 21.52,\n      \"environment\": {}\n    },\n    {\n      \"name\": \"cargo-fmt\",\n      \"command\": [\n        \"cargo\",\n        \"fmt\",\n        \"--all\",\n        \"--\",\n        \"--check\"\n      ],\n      \"cwd\": \"__HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-9-task\",\n      \"exit_code\": 0,\n      \"passed\": true,\n      \"elapsed_seconds\": 0.22,\n      \"environment\": {}\n    },\n    {\n      \"name\": \"go-compile\",\n      \"command\": [\n        \"go\",\n        \"test\",\n        \"-c\",\n        \"-o\",\n        \"/private/tmp/sps9-go.test\",\n        \".\"\n      ],\n      \"cwd\": \"__HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-9-task/bindings/go\",\n      \"exit_code\": 0,\n      \"passed\": true,\n      \"elapsed_seconds\": 1.26,\n      \"environment\": {\n        \"GOWORK\": \"off\",\n        \"CGO_ENABLED\": \"0\"\n      }\n    },\n    {\n      \"name\": \"go-format\",\n      \"command\": [\n        \"gofmt\",\n        \"-l\",\n        \"__HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-9-task/bindings/go/diagnostics.go\",\n        \"__HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-9-task/bindings/go/diagnostics_http_test.go\",\n        \"__HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-9-task/bindings/go/diagnostics_test.go\",\n        \"__HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-9-task/bindings/go/direct.go\",\n        \"__HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-9-task/bindings/go/direct_test.go\",\n        \"__HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-9-task/bindings/go/http.go\",\n        \"__HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-9-task/bindings/go/mode.go\",\n        \"__HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-9-task/bindings/go/pool.go\",\n        \"__HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-9-task/bindings/go/routing.go\"\n      ],\n      \"cwd\": \"__HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-9-task\",\n      \"exit_code\": 0,\n      \"passed\": true,\n      \"elapsed_seconds\": 0.01,\n      \"environment\": {}\n    },\n    {\n      \"name\": \"diff-check\",\n      \"command\": [\n        \"git\",\n        \"diff\",\n        \"--check\",\n        \"dev...HEAD\"\n      ],\n      \"cwd\": \"__HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-9-task\",\n      \"exit_code\": 0,\n      \"passed\": true,\n      \"elapsed_seconds\": 0.02,\n      \"environment\": {}\n    }\n  ],\n  \"original_matches_snapshot\": true,\n  \"original_sha256\": \"cd324267f177fbee62854bac346344b6dab48bf64d099116728b9645573b29c2\",\n  \"source_sha256\": {\n    \"README.md\": \"252d868d06d78d207f7b7c522fef6945a92d9a836343d836b88680b902ca2f50\",\n    \"bindings/go/README.md\": \"f88a61afeb3f1e4cab845915a0c7bbbe25fc46a5d5a2c729a5b380efebf0611b\",\n    \"bindings/go/diagnostics.go\": \"6d3009b720eac1df8a8feedc5fc213a33a1112ec80b8851b853afa93b387da6d\",\n    \"bindings/go/diagnostics_http_test.go\": \"5fad5770aecc764c2d0fa5055d1af70e8804a531de44097c3db5319e2790a589\",\n    \"bindings/go/diagnostics_test.go\": \"a917d442104971999d8952e02ac959034b217a06ace875daff12ee197859b7b3\",\n    \"bindings/go/direct.go\": \"d07142266ebc7de4600f60b1f952d4e79190dbe8f8d8229fbb78f1200595b462\",\n    \"bindings/go/direct_test.go\": \"5d49cdd2ec9b7199e1cbf2fad5991ebee081c7ec56179f5de00b62349ffe59e3\",\n    \"bindings/go/http.go\": \"4896d35419b8bdb5518e5437962c51835b6dd2c4b474c72662e8c57c1e1c7011\",\n    \"bindings/go/mode.go\": \"480d482412a6d26db5a91de3ca97af4e4c2993f3fc1bb548ed3a9a25d6552664\",\n    \"bindings/go/pool.go\": \"a6c9928b1ff8aa137df9581b4a0793aff553efd2471d675d41710038a2288463\",\n    \"bindings/go/routing.go\": \"849d72f330757c3072afaeca10b233f435dc19036c3f3f9c85fe32d0e52a61fc\",\n    \"docs/diagnostics.md\": \"db0c79ef5e35b4c5432fa784bd2a63d4c3e131dfe1ebf0c94c9c5a012181f1d3\",\n    \"docs/sps9-ledger.md\": \"51d3ceaacbd43f5462af3071910c05953f8305dba55d5080283d1354f0a8df57\",\n    \"src/backend.rs\": \"003997c2c24025a9729e8bba6ef91b497ee379a3d0dbf11a5952fdb805bbc596\",\n    \"src/dialer.rs\": \"e4266bca644c24ed7b4580426355c8a3de8a257891d5df72d8d260cbbcf316a0\",\n    \"src/health/state.rs\": \"c35fc10823b36acdf5f5fa905d04665126dff102a45bb86e138112c0e83d670c\",\n    \"src/http_proxy.rs\": \"96d417335a1864c75e09d3f13573ced904d7d6d34a9916bebe0775e4603a1f40\",\n    \"src/http_proxy_tests.rs\": \"6d877a5f4dfaa65093d88abbd55fdb5836a0abd4059432ed08b59a3cc2c113a9\",\n    \"src/lib.rs\": \"aa7fc025a69c92eebdadbf6a0cc5321c686f39f794c4737ef0c2b58d77cb5f71\",\n    \"src/native_plane.rs\": \"9dae54b3f474bae958bbfa2065c9ddb01a93faac39c3d516eb02f508477542d6\",\n    \"src/observation.rs\": \"f201b4e2d46703309e10380cf0637699fd563e3d29b9e39df15f07ce5f8cc106\",\n    \"src/outbound/direct.rs\": \"6d05c142ea4a47773c09792a911cf15ebdba1a897ba028d63b8bba3ae9872743\",\n    \"src/outbound/mod.rs\": \"5ecb50522a650b43fd42a735d05493497d1cedcc7f9a0d1b3478a874fe4369f0\",\n    \"src/outbound/registry.rs\": \"6a6afcf22f3be5993494b8b53b047912c95935988b8778439464856161279be6\",\n    \"src/outbound/reverse.rs\": \"00b5b92bb4ab2b9aabc3cf00a7d2ded2b16e5087e421c21229a5837a33023ae4\",\n    \"src/outbound/stream.rs\": \"511f345b881bae09f1dfdadfb3325ed97ed298d3b009bf148b5dad430aa63cce\"\n  }\n}"
        }
      ]
    },
    {
      "type": "heading",
      "level": 2,
      "text": "Not proven"
    },
    {
      "type": "list",
      "items": [
        "Rust/Go 测试、race、feature/跨语言/设备矩阵均未运行；编译不证明行为通过。",
        "没有执行测试 binary 或 init，也没有真实节点或 Steam 请求。",
        "默认网络观察的真实 OS 效果、真实恢复时新旧流无损和 XHTTP 长流留待 main 验收。",
        "Go EdgeOneWebSocket 反代不支持；其他平台网络观察需要宿主来源；没有进程级跨实例探测配额。",
        "Rust 精确逐 HTTP 请求首字节与 Go 原始 TCP 传输诊断尚未支持；Go HTTP/2 首字节字段明确为完整响应头边界；没有 Go 响应缓存。",
        "没有将拨号成本称为 RTT、将探测失败比例称为 IP 丢包率，也没有合成吞吐或更改选路评分。"
      ]
    }
  ]
};
