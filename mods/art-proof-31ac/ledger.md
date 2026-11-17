# SPS-9 设计、源码与验收台账

核对日期：2026-11-17。范围：剩余直连地址策略和本地诊断消费链，保留 SPS-1～8 实现。
此台账不表示全设计运行验收完成。

## 基线与来源

- 工作分支 task/9-task，开发目标 dev；起始 dev 为 `3861d8c332b5269b3b112ee17a048ce3b5a254c0`（SPS-8 PR #8 squash 合入）。
- 已核对 `67145a825b263e47a2953c2e94d7fb65bed62fb2` 到 dev 的实际源码差异：仅 Go 网络观察按编译目标拆为五个文件，是 SPS-8 人工返修；启动预算、HTTP 提交、H2 写锁修正均在 dev。不能用 squash 后不具有旧 SHA 祖先关系来否定合入结果。
- SPS-6 Planner 为 `d8ca233`，SPS-7 出口组合为 `24707ae`，均在 dev 历史；本任务不重新实现。
- 通过 Obsidian CLI 读取 `gamesir/需求/steam 加速/方案/Steam 商店加速-SDK路由与策略引擎设计.md`，与 `/private/tmp/steam-sdk-routing-design-20261115.md` 逐字节一致。
- 已读 SPS-8 `/private/tmp/sps8-proof/ledger.md`、checks-summary.json、review.txt；proof `go-proof-81f9`。其检查候选 `19335d7` 与唯一模型评审 `67145a8` 明确不同，后续人工返修不冒称模型已审。
- 已读 RTK.md；工作树及适用父目录未找到额外 AGENTS.md/CLAUDE.md 文件。Makefile 的绑定构建不是本轮允许的验证命令，未运行。

状态术语：

| 标记 | 严格含义 |
| --- | --- |
| 源码 | 已追踪生产调用链，或有对应测试源码；不等于运行通过 |
| 编译 | 仅获授权命令实际通过，最终 SHA、命令和日志由本任务 proof 绑定 |
| main 待验收 | 有实现但运行效果、并发、平台或真实节点尚未运行 |
| 不支持 | 已确认缺少该能力，不会靠未来运行检查自动变成已支持 |
| 未核实 | 当前证据不足，列出具体边界，不泛称实现缺失 |

本任务所有 Rust/Go 新旧测试均未执行；没有测试 binary/init、race、feature 矩阵、
设备、真实节点或 Steam 请求。新旧代码的对比是源码事实，不冒充失败→通过的行为复现。
正式评审报告和真实最终 SHA 放在 proof，不以预填 SHA 或此前评审替代。

## 本次实际改动

### 地址组合

原文 §2：“DirectOutbound<S> … 候选地址来源与地址选择策略”；§10：“从真实业务需要的候选地址中选择”；
§11：“解析或读取候选 → 优先使用历史表现好的地址 → 在允许的建连失败边界尝试其他地址 → 记录本次结果”。

起点事实：Rust S 是 TcpDialer，connect_addresses 内部固定排序；Go 有 Resolver，排序仍在 dialRoute 内。
本次新增 Rust DirectAddressStrategy（resolve/order/feedback）与 HistoricalAddresses，
S 是策略，dialer 独立。通过带默认实现的 TcpDialer::direct_addresses 接入 Native 组装，
不增加 Dependencies 必填字段。Go 保留 Resolver，通过可选 DirectAddressProvider 取得策略，
与 Dialer 原接口兼容。

生产链：Rust build_routes → Backend::create_in_generation → NativeStream/NativeHttp →
DirectOutbound → 地址策略 → 实际拨号 → 本代历史/反馈。HTTP 新建连接也使用策略来源；
池命中不额外解析。Go Create/prepareRoutes → Connect 或 Request → connectRoute/dialRoute →
Resolver/Order → 真实拨号 → 当前代反馈。策略不在健康锁内执行。

默认按失败数和真实成功耗时稳定排序，不后台测原站、不追加 TLS/HTTP 验证。
地址轮换仍在已有执行器同一 deadline 与取消边界内，既有 SNI/authority 和提交后不重放保持。
Rust 每代新对象，Go 每代 route.direct；自定义共享策略收到 generation，必须自行隔离其私有历史。

测试源码：

- Rust `replacement_strategy_is_wired_through_native_tcp_and_http_executors`：替代来源/逆序/反馈必须经过 Native routes 组装和两种执行器；C 启动没有业务拨号。
- Rust `direct_addresses_only_learn_from_business_and_history_is_per_generation`、`address_failover_shares_executor_deadline_and_cancellation`。
- Go `TestReplacementAddressStrategyThroughFactoryConnect`、`TestHistoricalAddressOrderAndGenerationIsolation`、`TestAddressFailoverUsesOneBudgetAndStopsOnCancellation`。
- Go `TestBusinessDiagnosticsFromRealHTTPReuseAndInterruptedBody` 同时断言 HTTP 使用替代策略且复用不重拨。

### 探测窗口和宿主消费

原文 §6.3：“最近 60 秒成功次数 / 完成次数，失败与超时进入分母，取消单列”；
“诊断与后续阈值验证；少量启动样本不做百分比熔断”。

起点有 60 秒、最多 256 条完成样本和单列累计取消，但 Rust Observer/Go Status 都不能消费窗口。
本次保留生产 Health/accessHealth 写入链，增加各最多 256 条的近期取消队列；
完成/成功和取消按读取时刻过滤，容量逐出显式 truncated，零分母 None/nil。
Rust Observer 兼容默认回调交付 Weak Registry-backed source，DiagnosticRecorder.snapshot.probes 读取当前代；
Go Mode.Diagnostics 直接复制当前代 accessHealth。重复接入地址按线路编号分组合并，不重计。
C-only 返回空接入点列表，没有原站样本。读窗口不会影响熔断或同层选择。

真实写入仍是 Rust check_routes_until → ProbeResult.completed → Health.record_at，
Go probeBatch/probeLoop → recordProbe。业务 record_outcome/record 不写探测样本，
取消不进入 completed，旧代反馈不污染新代。网络失效时 Rust source 返回 None，
发布后读取新 Registry；Go 锁内读取 current session/routes。
同端点的后台探测即使只由其中一条线路到期触发，也向全部关联 Health 记录同一完成结果，
因此不同 jitter/due 不会使导出的首条线路窗口漏掉其他线路触发的真实探测。

测试源码：Rust `diagnostics_read_expires_without_new_feedback_and_reports_truncation`、
`recorder_reads_live_deduplicated_probe_windows_and_new_generation`；
Go `TestDiagnosticsWindowReadExpiryZeroSamplesAndDeduplication`、
`TestBusinessDiagnosticsBoundedAndOldGenerationDoesNotPolluteCurrent`。
已有 recent_probe_window / TestRecentProbeWindowCancellationAndBusinessSeparation 保留。

### 业务诊断

原文 §6.3：“首字节、正文吞吐与中断 … 真实业务，缓存命中与连接复用单列”；
“首版不拿不同目标、响应大小的样本直接排名”。

Rust 现有生产链已完整的部分不重做：ObservedStream → UpstreamFirstByte，
Pingora HttpHeaders、HttpBody、HttpCacheHit、HttpReuse/Http2Reuse → Observer →
DiagnosticRecorder events/metrics/resources。缓存路径不混作上游正文，
被动字节流首字节可能是 TLS 记录，不是 HTTP TTFB。
已有资源/缓存/复用测试保留；memory/disk cache 条件测试不在默认 feature 编译覆盖之内。

Go 起点没有对应业务诊断消费链。本次 Request 在真实提交后开始计时，
HTTP/1 reader.Peek(1)、HTTP/2 固定依赖 trace 记录响应边界，
pool.take 实际命中标记单次复用，responseBody.Read/Close 记录真实正文 bytes/elapsed、
EOF、错误、提前关闭。Mode.Diagnostics.Business 返回最近 60 秒内最多 256 条记录，
带 route/generation/protocol，不含 URL/正文；旧代迟到事件不进入当前代。
没有缓存实现，CacheAvailable=false，不能声称命中率为零。
Go 的 TimedOut 与 Canceled 分别保留超时和调用方/实例取消，
SDK 预算触发内部 cancelRequest 不被写成业务取消；
`TestHTTPDiagnosticsSeparateSDKTimeoutFromCallerCancellation` 包含 HTTP/1、HTTP/2 两种来源对比，
只编译，不执行。Rust 窗口集成用例也覆盖共享接入点不同 due 下的失败与取消。
同轮进一步修正 HTTP/1 上传失败通过立即读 deadline 唤醒读者的诊断口径：
原写失败是否超时通过 atomic 状态同步传递，避免把普通上传错误归为超时；
`TestHTTP1UploadFailureWakeupIsNotRecordedAsTimeout` 为对应测试源码，未执行。

准确限制：Rust 精确逐 HTTP 请求首字节尚未支持，只有完整响应头耗时和字节流首字节；
Go HTTP/2 trace 的真实边界是首个完整 HEADERS，显式 FirstByteBoundary=http2-response-headers，
不是线上首字节；Go 原始 TCP 首字节/吞吐诊断尚未支持。
正文数据是被动原始观测，未新增自动吞吐值、RTT、IP 丢包率或跨目标评分。
无需真实节点的读法和具体口径见 diagnostics.md。

## 剩余歧义的处置

| 项目与原文 | 实际调用链/依据 | 结论 |
| --- | --- | --- |
| §6.2“全局并发上限 3”，§7“探测并发 3” | Rust 每次本实例检查创建 ProbeScheduler/Semaphore，维护任务串行等待旧探测后换代；Go 每 session probeLoop 的 inflight/worker 上限 3，startup runner 同上 | 全部本实例接入点共用 3；不是每节点 3。原文未说明多个 SDK 实例是否要共享进程配额。跨实例进程上限未实现；不擅自加全局状态 |
| §2“EdgeOneWebSocket … TCP 载荷 backend”，§3“沿用现有入口” | Rust RemoteBackend::payload 与 normalize 按能力过滤；Go RemoteBackend 原本没有该枚举/反代配置，Forward 的 WSS 是另一条能力 | Rust 依 websocket feature 支持 TCP；Go 此反代 backend 不支持。不能把 WSS tunnel 当作它；本任务不扩 wire |
| §8“网络变化时使旧网络测量失效”与开篇“宿主继续负责…系统设置” | Rust network_change::revision，Go 按编译目标选 localNetworkRevision；已有 dialer network_revision/NetworkObserver 优先 | Linux/macOS 默认轮询部分本机字段；不保证所有网络变化。其他平台需宿主源；不重写平台适配 |
| §8“高优先级…新请求…选回；已有连接继续使用原出口” | Planner 仍每次按固定层级；HTTP RequestContext/Go responseBody 持有旧连接；Registry active/route users 保护已有流 | 已有实现，新增真实本地 HTTP 流共存测试源码；未运行，归 main 待验收，不再以“完全无证据”列 D |

网络观察细节：Rust Linux 读取 /proc/net/route、ipv6_route、if_inet6、fib_trie、
resolv.conf；macOS 读取 route/ifconfig 稳定字段，不完整覆盖 DNS。
Go Linux 读取接口/地址、路由、resolv.conf，macOS 接口/地址与默认网关。
同网关同地址 Wi-Fi 切换、所有 VPN/DNS 变化、轮询间瞬变均不保证检测。
Go Android/iOS 显式走无默认源的编译分支；Rust 只 Linux/macOS 有默认源。
读取失败保留上次身份，宿主源必须可取消且不连接业务目标。

共存测试新增：
Rust `recovered_higher_tier_serves_new_http_while_lower_tier_body_survives`，
Go `TestRecoveredHigherTierKeepsLowerTierResponseAlive`。
均通过健康反馈入口注入两次成功，再经过真实 HTTP 调用观察 A 恢复后新请求走 A，
原 B 正文仍可消费；不冒称已验证真实节点恢复探测或设备无损切换。

## 全章节核对

| 原文章节 | 当前源码事实 | 状态/未验收 |
| --- | --- | --- |
| §1 依据/宿主 | Factory/生命周期/原始目标交付保留，独立 Go 实现 | 源码；宿主设备 main 待验收 |
| §2 能力/层级 | 统一反代、C 地址策略、D 隧道、A→B→C→D 与载荷/下载过滤 | 源码；Go EdgeOneWebSocket 不支持 |
| §3 配置 | 原 Routes/ModeConfig、Factory 与白名单，不新增 wire 字段 | 源码；跨语言设备 main 待验收 |
| §4 职责 | native 组装，routing 选路/预算，outbound 连接/资源，health 统计/归因，probe 独立 | 源码；未重做 Planner/出口栈 |
| §5 状态/锁 | 健康短锁；地址策略用复制历史，回调不持锁；新诊断只读副本 | 源码；并发 race main 待验收 |
| §6/6.1 探测 | 仅接入点，拨号总成本；目标/业务不经 Probe | 源码；不是 RTT，真实节点 main 待验收 |
| §6.2 调度 | 实例内上限 3、去重/3 秒/总预算/抖动/退避/恢复、旧代取消等待保留 | 源码；进程总限额未实现，原文作用域未明 |
| §6.3 指标 | 新增窗口消费和 Go 业务诊断，Rust 原事件复用，不改排名 | 源码/编译；精确 HTTP 首字节与 Go TCP 诊断限制见上 |
| §7 Start | 资源准备后统一资格，C 无原站探测、超时失败均汇总 | 源码；运行 main 待验收 |
| §8 健康/恢复/网络 | 业务隔离/目标冷却不被 probe 清除，网络代际防迟到，新旧流持有分离 | 源码；新共存测试仅编译，真实网络 main 待验收 |
| §9 Restart | 旧 close 等待，fresh Inner/session，旧 clone 不转向、失败保留状态 | 源码；本轮未改，运行 main 待验收 |
| §10 组合/池 | S 已是真实地址策略；Native HTTP/TCP 接入；SNI/authority/ALPN/connector/generation 隔离 | 源码/编译；协议矩阵 main 待验收 |
| §11 预算/提交 | 地址轮换共享 deadline/取消；可能提交后不跨候选重放 | 源码/编译；新旧竞态 main 待验收 |
| §12 落点/验收 | 原 routing/outbound/health/probe 布局，全部 23 场景逐项列在下表 | 源码/编译不是全设计验收 |

## 第 12 节全部 23 个场景

下表测试名称为源码索引。默认 feature 内 Rust/Go 测试源码只编译；
条件 feature 测试不表示本轮已编译该分支，更不表示已运行。

| # | 原文场景 | 实现/测试源码依据 | 未完成验收 |
| --- | --- | --- | --- |
| 1 | Relay/CDN 同配，A 优先 B | reverse 统一流程，fixed_tiers_exhaust_same_tier_and_hash_is_stable / TestPlannerFixedTierAndSameTierFallback | main 运行 |
| 2 | A1 失败先 A2，B 更快 | Planner/Attempt tried，同上及 routed_h2_selects_per_request_exhausts_relays_and_isolates_upstream_pools | main 运行 |
| 3 | A1 40/A2 45/B10，稳定同层 | failure_count_then_twenty_percent_window_then_capability_filter / TestPlannerFailurePreferenceLatencyAndCapabilities | main 运行 |
| 4 | 慢 DNS/dialer 轮换计入成本 | TcpProbe 从调用前计时，ProbeResult.completed；窗口不标 RTT | 专门慢 DNS 组合运行未核实，main 补验 |
| 5 | 单次失败偏好、连续阈值 | health_ewma_recovery_backoff_expiry_and_generation / TestAccessHealthIsolationBackoffRecoveryAndEWMA | main 运行 |
| 6 | A 不可用按 B/C/D | 固定层级、能力过滤和共享 Attempt | main 运行/协议矩阵 |
| 7 | TCP 遇 HTTP backend | normalize/filter，edgeone_websocket_is_filtered_from_http_candidates_before_probing / TestDownloadEligibilityUsesBackendCapability | Go EdgeOneWebSocket 反代不支持；其余 main 运行 |
| 8 | Start 部分超时 | startup_budget_settles_slow_remotes_and_keeps_local_direct_available / TestStartupBudgetAndCancellationWaitForAllProbes | main 运行 |
| 9 | 只 C 不探原站 | direct_only_start_never_connects_origin_and_close_stops_pending_calls / TestDirectOnlyStartAndBackgroundNeverDialOrigin；本次替换策略用例 | main 运行 |
| 10 | 所有候选无资格 | startup_collects_failed_and_good_candidates_and_rejects_all_failed / TestStartupRejectsAllInaccessibleLegacyRoutes | main 运行 |
| 11 | 反代/隧道只探接入 | tcp_probe_only_opens_access_socket_and_closes_without_writing / TestStartupAccessQualificationBeforeRunning | main 运行，真实节点未测 |
| 12 | 全业务出口拒绝仍能 probe | startup_probe_works_with_every_http_and_stream_outlet_replaced_by_refusal，Probe 不导入业务出口 | main 运行 |
| 13 | TCP 成功不清凭据/429 | outcome Isolate/Target 分离、inherit；HTTP no-replay/health 测试保留 | main 运行 |
| 14 | 冷却/C 地址/网络变化不主动测 Steam | 地址策略 per-generation；native_network_event_keeps_committed_stream_resets_history_and_stops_subscription / TestNetworkChangeDirectOnlyKeepsStreamAndClearsHistoryAndStopsObserver | main 运行；默认源限制保留 |
| 15 | 高优先级恢复，新旧流并存 | 本次 recovered_higher_tier_serves_new_http_while_lower_tier_body_survives / TestRecoveredHigherTierKeepsLowerTierResponseAlive | 测试只编译，真实恢复/流共存 main 运行 |
| 16 | 用户选 B1 restart | restart_validates_first_and_keeps_old_handle_when_close_fails / TestRestartValidationFailurePreservesOldSession | main 运行/宿主交接 |
| 17 | Closed 要新 Mode | restart_replaces_inner_and_old_clones_remain_closed_on_success_and_failure / TestRestartFreshSessionClosesOldConnections | main 运行 |
| 18 | 重启旧流结束不重放 | 原生命周期 close-before-start，旧 clone/session 保留关闭含义 | main 运行/设备 |
| 19 | 新 start 失败或 close 未完 | TestRestartCloseFailureDoesNotStartReplacement / TestRestartNewStartFailureAndCancellation；Rust 对应 lifecycle 用例 | main 运行 |
| 20 | 可能已发送后不重放 | attempt_loop_shares_deadline_across_candidates_and_stops_after_commit；HTTP commitment；TestHTTPPoolReuseAndNoReplayAfterCommit | main 运行/竞态 |
| 21 | Planner 无网络 | injected_filter_and_selector_borrow_candidates_with_fixed_tier_order；Go plannerFixture 测试 | main 运行 |
| 22 | 原配置/语言绑定 | Dependencies 字段与 wire/ABI 不变；Rust 默认 trait 方法、可选诊断 JSON；Go 可选 provider 和新读取方法 | 编译本任务默认目标；绑定/设备矩阵未运行 |
| 23 | cancel/close 收敛 | cancel_drains_running_and_queued_probes；SPS-8 网络/池关闭用例；本次地址取消与弱诊断源 | main 运行/race/真实长载流 |

## 交付边界

允许检查：`cargo check --offline --locked --tests`、`cargo fmt --all -- --check`、
`git diff --check`；Go 在 bindings/go 下 `GOWORK=off CGO_ENABLED=0 go test -c`，
另核对改动 Go 文件格式。编译告警保留原始日志，不将告警误写成零。
最终 proof 绑定真实 SHA、完整 patch、原文校验、检查日志、唯一正式 reviewer 报告和本台账。

没有新增依赖、部署、进程全局配额、Go EdgeOneWebSocket wire、系统代理/CA 操作或平台重写。
没有推送/合并 main、tag、部署、Accept/Done；PR 目标为 dev，人工审核决定接受与合并。
Not proven：所有行为测试、竞态与 feature/跨语言/设备矩阵，真实节点/Steam，
默认网络源真实 OS 效果、XHTTP 长流和恢复时无损，均留 main 阶段另行授权运行。
