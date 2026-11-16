# SPS-7 完整需求与验收台账

核对日期：2026-11-16。本节是本次最终状态；后面完整保留 SPS-6 的逐章节和全部场景台账作为基线记录，不把旧提交的证据当作本次通过。

- 实际起点：dev / origin/dev / task/7-task 均为 d8ca233（SPS-6 已经 squash 合入）；工作树开始时干净，不是 eeb40b4。
- 原笔记再次通过 Obsidian CLI 完整读取，与 /private/tmp/steam-sdk-routing-design-20261115.md 逐字一致。
- 已读 SPS-6 最终 recipe、review 和 ledger。其 Planner 候选 bfe9fcb 的合入提交是 d8ca233；本次静态核对 Planner 主体不变。
- 首个完整候选提交：733b02b9d3236495c36fa54c12dedd2729af8f9c。
- 最终提交：1136014e45ef1a81baf5a4da2594a280d67d0431。指定 codex / auto/gpt-6-astra / medium 唯一正式评审在同轮核对最终修正，待最终报告。
- 初次报告有两项 major：替换隧道未接入 Native 会话关闭等待、共享 HTTP 适配器仍固定 BuiltinTunnel。均已修正；没有隐去报告或把旧 SHA 伪记成最终审查。
- A 只表示源码事实/静态证据；B 表示实现存在但运行未验收；C 是明确实现缺口；D 是尚待核实。没有任何本次行为运行通过证据。

## 本次覆盖与当前结论

| 设计要求 | 本次接口 → 真实调用点 | 测试源码及静态证据 | 当前状态 |
| --- | --- | --- | --- |
| §2/4/10 反代 backend 身份组合 | ReverseBackend::route / ReverseProxy<B> → NativeHttp<B>::prepare → Executor<&H>::prepare → http_proxy::upstream_peer 与 upstream_request_filter；endpoint、SNI、authority 和目标头由 backend 返回 | reverse_backends_keep_access_identity_target_headers_downloads_and_tcp_payload；edgeone_origin_alias_is_verified_as_its_own_identity_without_target_headers；replaced_reverse_and_http_capabilities_reach_pingora_headers_tls_and_connector | 原 C 更新为 A（组合/接线源码），行为仍 B；Relay/CloudflareWorker/EdgeOne/EdgeOneOrigin 下载与目标头差异保留；EdgeOneWebSocket 仍走 TCP |
| §2/10 隧道替换 | Tunnel / TunnelOutbound<T> → NativeStream<T>::connect；HTTP D → NativeHttp<B,T>::connect → NativeStream<T>::tunnel → 同一 TunnelOutbound<T>；BuiltinTunnel 使用原协议实现 | replacement_tunnel_reaches_native_stream_executor_and_drains_on_budget_and_close；replacement_tunnel_composes_through_http_origin_tls_pool_and_native_session_shutdown；原 carrier cancellation / WebSocket / VLESS 测试源码保留；新增 websocket、shadowsocks 编译覆盖 | 原 C 更新为 A（组合源码），行为仍 B；VLESS/XHTTP 后续 carrier 的原 armed、deadline、DropGuard、TaskTracker、socket 归属保留；HTTP/stream 契约必需异步 close，Native Session 实际等待所装入的能力，共用隧道通过 OnceCell 只关闭一次 |
| §4/10 HTTP 与 stream 执行器 | Executor<&H> 消费 HttpOutbound::{prepare,connect}；Executor<&S> 消费 StreamOutbound::connect；StreamOutlets 按编号取出口，AttemptLoop 不再接受整个 Backend | 替换反代+HTTP 的真实 Pingora 测试源码；replaced_http_executor_uses_remaining_budget_and_rejects_after_commit_or_cancel；native_replaced_stream_marks_possible_submission_and_never_replays | 原 C 更新为 A（组合与调用源码），行为仍 B；能力替换能进入实际 Native/HTTP/TCP 执行及 Registry 结果归因 |
| §4/5/11 Planner、锁、资格和预算 | SPS-6 Planner<F,N> 主体不改；select 只返回编号并在调用侧记 tried；取得 stream 后再复查；HTTP 队列后及 connector 执行前复查 | 静态比较 Planner 主体一致；原路由测试断言保留；attempt_loop_shares_deadline_across_candidates_and_stops_after_commit | A（源码保留）/ B（运行）；固定 A→B→C→D，不新增选路或健康存储 |
| §10/11 C/D 原站身份与池 | HttpRoute.sni/authority/endpoints/transport → 原 Pingora TLS peer；group_key 保留出口、generation、authority、SNI、port、WebSocket ALPN 分组，并加入 transport；原 connector 与 bridge 复用 | 原 caller_mapped_origins_preserve_http_and_isolate_verified_tls_pools、http_over_tunnel_negotiates_origin_tls_and_reuses_only_its_own_pool 等源码仍在 | B；静态编译不证明 TLS、池复用与关闭行为运行正确 |
| §6/12 探测不经业务出口 | check_routes → ProbeScheduler → ProbeRunner<TcpProbe<D>>；HTTP 和 stream 业务能力均可替换为拒绝实现 | startup_probe_works_with_every_http_and_stream_outlet_replaced_by_refusal：直接调用真实 check_routes，全部业务出口 panic，接入点去重、EOF 无业务写入 | 原场景 12 的 D 更新为 A（完整场景源码）/ B（运行未验收） |
| §12 目录和宿主边界 | routing/、outbound/、health/、probe/ 原职责保留；增加 outbound/stream.rs 和简短 docs/outbound.md | 本次文件 diff；公开配置、wire、绑定、依赖、工具、部署与系统网络无改动 | A（源码事实）；跨语言/设备仍 B/D |

## 第 12 节完整场景在本次最终代码上的状态

1. Relay/CDN 同配：共享反代组合缺口已实现；原 A 优先于 B 算法保留。A（源码），B（运行）。
2. A1 失败继续 A2：算法与原测试源码保留，B。
3. 40/45/10ms 同层稳定分配：Planner 主体不变，B。
4. 慢 DNS/地址轮换计 dial 而非 RTT：probe 未改，B；专用组合断言仍待 main 核实。
5. 单次失败偏好与连续失败隔离：健康算法未改，B。
6. A 不可用逐级 B/C/D：固定层级保留，B。
7. TCP 过滤 HTTP backend：配置与 filter 保留；反代能力另拒绝把 EdgeOneWebSocket 用作 HTTP。A（源码）/ B（运行）。
8. Start 部分超时：启动与调度实现保留，B。
9. 仅 C 启动无 Steam 主动探测：保留，B。
10. 全部无资格：保留，B。
11. 反代隧道只探接入：probe 不经出口，源码保留，B。
12. 全业务出口拒绝仍探测：本次补齐真实 check_routes 的完整场景测试源码，A（源码）/ B（运行）。
13. TCP 成功不清凭据/429且不追加：健康/HTTP 归因不改，B。
14. 冷却/C 地址/网络变化：前两者保留；实例内网络变化整链仍 C，不能整体通过。
15. 高优先级恢复、新旧流并存：D，缺完整流共存验收证据。
16. 用户选择 B1 restart：生命周期入口未改，B。
17. Closed 创建新 Mode：未改，B。
18. 切线旧连接结束不重放、新启动后交接：未改，B；设备/宿主交接未验收。
19. 新 start 失败或旧 close 未完：生命周期未改，B。
20. 可能发送后不重放：原 HTTP 回调边界保留；stream 替身可显式标记 committed，真实 Native 路径测试源码新增；A（源码）/ B（运行）。
21. Planner 纯内存输入：SPS-6 实现保留，A（源码）/ B（运行）。
22. 原配置和绑定入口：未改，B；跨语言不由 Rust trait 重构证明。
23. 取消/close 收敛：XHTTP 原 carrier 任务和 guard 保留，新增 tunnel 替身 timeout、在途取消、close 后不再调用场景源码。另有测试源码把替换隧道装入真实 HTTP D，再调用实际 Session::run 关闭，断言其自有异步任务等待完成、协议只关闭一次；A（源码）/ B（完整行为仍未运行）。

## 仍然存在的实现缺口

- C / P1：Rust 和独立 Go 的实例内网络变化整链未实现，包括取消旧探测、换 generation、废弃测量/地址记录/池、重新检查；restart 不能替代。这不属于本任务。
- D / P2：独立 Go 的 CDN 下载能力差异、近期探测统计，DirectOutbound 地址选择策略是否需进一步独立替换，以及高优先级恢复时新旧流共存的完整验证，继续待核实。
- 独立 Go 和 C/TS/Swift/Kotlin 沿用下文基线状态，本次未修改，不能自动销项。
- 反代、tunnel 与 HTTP/stream 执行器的三项组合实现缺口已由本次源码补齐；不能把其运行验收状态标成通过。

## 本次 Not proven

- 依用户“dev 不回归，main 才回归”，未执行 cargo test、运行回归、feature/race 矩阵、跨语言、设备、真实节点或 Steam 请求。
- 新增测试仅有源码和编译证据；结构核对、静态编译和唯一独立评审均不证明业务运行通过。
- 原站 TLS、authority、池隔离、XHTTP 长期 carrier、迟到回调与全部关闭组合，仍需要 main 阶段实际运行验收。
- 明确的网络变化实现缺口不能用“等 main 跑测试”替代实现。

---

# SPS-6 基线台账（历史原文，供定位；当前结论以以上 SPS-7 部分为准）

核对日期：2026-11-16。基线 dev / origin/dev / task/6-planner 均为 eeb40b49005ffe0872f07d4dd8d254764a03f105（含 SPS-5）。
原笔记已通过 Obsidian CLI 完整读取，与 /private/tmp/steam-sdk-routing-design-20261115.md 内容一致。
下列路径均相对 SDK 仓库；独立 Go 为 bindings/go，其他绑定为 C / TS / Swift / Kotlin。

## 判定规则与证据归属

- A：实现已有且有对应证据。仅用于明确标注的结构/源码事实或本轮静态检查，绝不表示业务运行验收。
- B：有实现但运行未验收。列出的测试名称仅是测试源码，存在于基线 eeb40b4；没有本轮最终 SHA 的运行结果。
- C：明确实现缺口。源码已确认缺少设计所需组合/行为；本轮除 Planner 外不修改。
- D：尚待核实。未找到完整对应测试或无法由已读源码证明端到端要求。
- 本轮不运行任何 Rust/Go 测试、回归、race、feature 矩阵、跨语言/设备/Steam/真实节点请求。静态编译和独立评审不能替代运行验收。旧 SHA 的历史矩阵不计入最终代码的通过证据。
- 第一步台账在修改前建立。Planner 基线为 C；交付时以最终提交及静态证据追加更新，不覆盖基线事实。

## 各章节实质要求

| 章节 / 要求 | 范围及源码 | 对应测试源码 / 证据 | 当前结论 |
| --- | --- | --- | --- |
| §1 原有接口、注入与宿主边界 | Rust src/lifecycle.rs，src/network.rs；Go mode.go | tests/serve_connection.rs；policy_lifecycle.rs | B；宿主系统接管与设备行为未验收 |
| §2 能力与固定层级、下载排除 | Rust routing/config.rs、filter.rs、select.rs；Go routing.go::usable/selectRoute | routing/tests.rs::fixed_tiers_exhaust_same_tier_and_hash_is_stable、failure_count_then_twenty_percent_window_then_capability_filter；Go routing_test.go | B；Go usable 对所有 B 排除下载，Rust 只禁止 CloudflareWorker/EdgeOne，跨实现契约差异需后续核实 |
| §2/10 共享反代实际流程 | Rust http_proxy.rs::upstream_peer/upstream_request_filter，outbound/reverse.rs::http_route | src/http_proxy_tests.rs::pingora_h1_reuses_relay_and_preserves_headers_query_and_upload | B；共享 Pingora 栈存在，不等于泛型 backend 流程完整 |
| §2/10 ReverseBackend / ReverseProxy<B> | Rust outbound/reverse.rs；routing/config.rs；http_proxy.rs | 基线源码：trait 仅 allows_download/target_headers，http_route 直接匹配 ModeConfig；header 行为仍由公共流程判断 | C，P1：泛型包装未承载接入身份、SNI、authority、目标头差异及反代流程；不以类型名认定完成 |
| §3 Routes、旧配置归一化、payload、CA/feature 校验 | Rust config.rs、routing/config.rs；Go routes_config.go、config.go | tests/routes.rs::dynamic_routes_round_trip_and_payload_policy；Go TestRoutesConfiguration | B；公共配置本轮不改 |
| §4/5 Planner 可组合且只借用数据返回编号 | Rust routing/filter.rs、select.rs | 基线单元 struct Planner；算法内联；只有 filter::allows，未有策略契约 | C，P1，本轮修复对象 |
| §4/5 健康所有权、短锁、执行前复查 | Rust outbound/registry.rs、routing/attempt.rs、http_proxy.rs::upstream_peer；Go routing.go::connectRoute | routing/tests.rs；Go TestAttemptCandidatesShareDeadline | B；选择返回后锁释放，获取出口和 tried 更新在调用侧 |
| §4/10 执行与归因替换 | Rust routing/attempt.rs::Executor/AttemptLoop<E,O>/StreamExecutor，health/outcome.rs；HTTP 直接 Pingora callbacks | routing/tests.rs::attempt_loop_shares_deadline_across_candidates_and_stops_after_commit | C，P1：字节流 Executor 参数仍是 Arc<Backend>，HTTP 没有对应可替换小出口契约；已有复用流程不能代替 Executor<H>/Executor<S> 组合 |
| §6/6.1 独立 Probe、仅接入地址、dial 总耗时、关闭不写业务 | Rust probe/{mod,tcp,runner}.rs；native_plane.rs::check_routes；Go probe.go | src/probe/tests.rs::tcp_probe_only_opens_access_socket_and_closes_without_writing；Go TestTCPProbeOnlyDialsAccessAndImmediatelyCloses / TestTCPProbeDialElapsedExcludesClosingCost | B；TcpProbe 不导入 Route/Backend，计时包括 dial，非 RTT |
| §6.1/6.2 并发、去重、单次与总预算、取消 | Rust probe/scheduler.rs，native_plane.rs::check_routes（3 / 3s / 15s）；Go probe.go、routing.go | src/probe/tests.rs::scheduler_summarizes_all_timeouts_and_bounds_concurrency_and_total_budget、cancel_drains_running_and_queued_probes；Go probe_test.go | B；Rust 分批串行维护，同批按 endpoint 去重，跨实例“全局”并发含义尚待核实 |
| §6.2 健康阈值、恢复、防抖、过期 | Rust health/state.rs、routing/filter.rs；Go routing.go::accessHealth.record/usable | routing/tests.rs::health_ewma_recovery_backoff_expiry_and_generation；Go TestAccessHealthIsolationBackoffRecoveryAndEWMA | B；3 失败、2 成功、15..120s、60s 证据规则有实现 |
| §6.3 EWMA / 最少失败 / 20% / 稳定哈希 / 同层用尽 | Rust health/state.rs、routing/select.rs；Go routing.go | routing/tests.rs 前两项；Go TestPlannerFixedTierAndSameTierFallback / TestPlannerFailurePreferenceLatencyAndCapabilities | B（算法）；Rust 策略替换为 C，本轮修复；默认阈值不改 |
| §6.3 统计与诊断 | Rust health/state.rs::samples/cancellations、observation.rs；Go accessHealth 只保留失败/恢复/elapsed 等 | 无完整近期成功率、首字节/吞吐/复用分类对应运行证据 | D；Go 60s 成功/完成样本及取消单列未见对应存储，Rust samples 暴露与业务诊断链待核实 |
| §6.3/11 C 真实业务地址排序与历史 | Rust outbound/direct.rs::DirectOutbound<S>；Go routing.go::directKey/connectDirect | direct.rs::direct_addresses_only_learn_from_business_and_history_is_per_generation；Go TestDirectBusinessIPRotationAndMapping | B；Rust S 为 TcpDialer，地址选择算法固定，未有独立可替换选择策略；是否要求另拆策略待核实 |
| §7 Start 先汇总全部资格、仅 C 可启动、无候选失败 | Rust native_plane.rs::prepare_routes/check_routes，lifecycle.rs；Go lifecycle.go、routing.go | tests/routes.rs::startup_collects_failed_and_good_candidates_and_rejects_all_failed、direct_only_start_never_connects_origin_and_close_stops_pending_calls、canceled_start_drains_probes_and_never_accepts_business_before_publication；Go startup_contract_test.go | B |
| §8 分离接入、出口隔离、目标冷却、响应和取消 | Rust health/outcome.rs、state.rs、outbound/registry.rs、http_proxy.rs::AcquisitionTarget；Go routing.go::businessFailure、http.go | Rust routing/tests.rs、http_proxy_tests.rs::acquisition_watchdog_counts_access_timeouts_once；Go routing_http_test.go / review_regression_test.go | B；隔离不由 TCP 探测清除，状态码不作接入失败 |
| §8 同实例高层恢复、已有连接保持 | Rust health/state.rs、routing/select.rs、relay.rs；Go probeLoop/selectRoute | 有健康恢复与固定层级测试源码，未见完整“恢复时新旧流并存”专用测试 | D：组合实现存在，完整验收缺证据 |
| §8 网络变化 | Rust native_plane.rs:636 仅 prepare_routes 新建 generation；Health 拒绝旧 generation；DirectOutbound generation 不可变；Go routing.go:63 仅 prepareRoutes 递增；pool.go 按 generation 隔离 | generation 测试只验证旧结果拒绝 / 新会话，不证明网络事件处理 | C，P1：实例内网络事件、取消旧探测、更新 generation、废弃旧测量/池和重新检查整条链缺失；src/network.rs 是 TUN 契约；restart 不能替代 |
| §9 restart 关闭再新建、失败契约和旧 clone | Rust lifecycle.rs::restart；Go lifecycle.go | tests/policy_lifecycle.rs::restart_validates_first_and_keeps_old_handle_when_close_fails、restart_replaces_inner_and_old_clones_remain_closed_on_success_and_failure；Go lifecycle_test.go | B；同类型 Profile 保留，创建新 Inner |
| §10 TunnelOutbound<T> | Rust outbound/tunnel.rs::TunnelOutbound / Forward；Backend 调用具体对象；Go tunnel.go 与各实现 | tests/tunnel_ingress.rs；Go tunnel_*test.go | C，P1：具体 cfg 字段 / enum 复用协议存在，但未实现可替换 T 的组合契约；不是协议未实现 |
| §10 HTTP 经 C/D 的 TLS、authority、connector、池隔离 | Rust http_proxy.rs::upstream_peer/UpstreamConnector，outbound/registry.rs::SocketBridge；Go pool.go / routing.go | Rust http_proxy_tests.rs::http_over_tunnel_negotiates_origin_tls_and_reuses_only_its_own_pool、caller_mapped_origins_preserve_http_and_isolate_verified_tls_pools；Go TestConnectionPoolIdentityIsolation / TestHTTPOverWSSTunnelVerifiesOriginTLSAndReusesConnection | B；Rust backend 指针、generation、authority、SNI、port、WS 参与 group_key，ALPN 在 WS 分组；全部维度及 close 必须 main 运行 |
| §11 deadline、tried、commit、不跨线重放 | Rust routing/attempt.rs、retry.rs、backend.rs::connect_until、http_proxy.rs callbacks；Go routing.go/http.go | routing/tests.rs::attempt_loop_shares_deadline_across_candidates_and_stops_after_commit；Go TestHTTPPoolReuseAndNoReplayAfterCommit / TestHTTP2RefusedStreamAndGoAwayDoNotReplay | B；本次只保留现有边界 |
| §12 目录和依赖方向 | Rust routing/、outbound/、health/、probe/；native_plane.rs 组装 | eeb40b4 git tree 与实际文件（本轮读取） | A（仅结构事实）；目录到位不证明组合完成 |
| §3/9/12 独立 Go 同契约 | bindings/go/{routes_config,routing,probe,pool,lifecycle}.go，独立 go.mod | Go routing/lifecycle/probe/http 等 *_test.go，所属 eeb40b4 | B / D；独立实现，不受 Rust trait 重构自动修复；网络变化明确 C；下载能力差异及统计待核实 |
| §3/9/12 C / TS / Swift / Kotlin 绑定 | bindings/c/src/{protocol,native,actor}.rs；ts/lib/index.d.ts；swift/NativeEngine.swift；kotlin/NativeEngine.kt | C native_tests.rs::restart_retains_owner_on_close_failure_and_reports_start_failure，TS lifecycle.test.cjs；Swift/Kotlin 设备证据未有 | B（源码入口已有）；wire 本轮不改，跨语言/设备仍未运行验收 |

## 第 12 节全部场景

每项“测试”仅指基线 eeb40b4 的源码，不是运行通过。无当前最终 SHA 的行为运行证据。

| 场景 | 实现位置 / 对应测试源码 | 当前结论 |
| --- | --- | --- |
| 1 Relay 与 CDN 同配 | Rust routing/config.rs、http_proxy.rs；routing/tests.rs 固定层级；Go routing_http_test.go::TestHTTPBusinessFallbackTriesA2BeforeFasterB | B；共享栈已有，backend 组合缺口见上 |
| 2 A1 失败 A2 可用 B 更快 | Rust select.rs；fixed_tiers_exhaust_same_tier_and_hash_is_stable；Go 同名业务 fallback 测试 | B |
| 3 40/45/10ms 稳定分配 | Rust select.rs；fixed_tiers_exhaust_same_tier_and_hash_is_stable；Go TestPlannerFixedTierAndSameTierFallback | B |
| 4 慢 DNS / 地址轮换计 dial 非 RTT | Rust probe/tcp.rs；tcp_probe_only_opens_access_socket_and_closes_without_writing；Go TestTCPProbeDialElapsedExcludesClosingCost | B；慢 DNS 专用组合断言待 main 核实 |
| 5 单次失败偏好 / 连续阈值 | Rust health/state.rs、select.rs；failure_count_then_twenty_percent_window_then_capability_filter / health_ewma_recovery_backoff_expiry_and_generation；Go routing_test.go | B |
| 6 A 不可用逐级 B C D | Rust select.rs；fixed_tiers_exhaust_same_tier_and_hash_is_stable；Go TestPlannerFixedTierAndSameTierFallback | B |
| 7 TCP 过滤 HTTP backend | Rust config.rs、filter.rs；tests/routes.rs::edgeone_websocket_is_filtered_from_http_candidates_before_probing、routing/tests.rs 能力测试；Go TestRoutesConfiguration | B；Rust 规范化直接略过不兼容入口 |
| 8 Start 部分超时 | Rust prepare_routes / ProbeScheduler；src/probe/tests.rs::scheduler_summarizes_all_timeouts_and_bounds_concurrency_and_total_budget；Go TestStartupBudgetAndCancellationWaitForAllProbes | B |
| 9 仅 C 启动无原站探测 | Rust native_plane.rs::check_routes；tests/routes.rs::direct_only_start_never_connects_origin_and_close_stops_pending_calls；Go TestDirectOnlyStartAndBackgroundNeverDialOrigin | B |
| 10 全部无资格 | Rust prepare_routes / select.rs；tests/routes.rs::startup_collects_failed_and_good_candidates_and_rejects_all_failed；Go TestStartupRejectsAllInaccessibleLegacyRoutes | B |
| 11 反代隧道只探接入 | Rust probe/tcp.rs / normalize；tests/tunnel_ingress.rs::each_tunnel_starts_without_ca_and_only_probes_the_node_before_handoff；Go TestTCPProbeOnlyDialsAccessAndImmediatelyCloses | B |
| 12 拒绝调用的全部业务出口不妨碍探测 | Rust Probe 不引用 Backend，probe/tests.rs 仅注入内存 dialer；Go Probe 同样独立 | D：结构独立存在，但未找到“全部替换为拒绝业务实现”的完整场景源码/运行证明 |
| 13 TCP 成功不清凭据/429且不追加 | Rust state.rs/outcome.rs；routing/tests.rs 健康隔离；tests/routes.rs::direct_http_preserves_mapped_identity_and_does_not_replay_business_response；Go TestTunnelCredentialsRemainIsolatedAfterTCPProbeSuccess / TestHTTP429IsBusinessResponseAndDoesNotReplay | B |
| 14 冷却/C 地址/网络变化 | Rust filter.rs/direct.rs/native_plane.rs；Go routing.go | C：冷却与业务地址学习有实现，实例内网络变化链缺失；不得整体判通过 |
| 15 高优先级恢复新旧流 | Rust health/state.rs/select.rs、relay.rs；Go routing.go | D：单独健康和层级测试存在，完整流共存场景待验收 |
| 16 用户 B1 restart | Rust lifecycle.rs::restart；policy_lifecycle.rs restart 测试；Go TestRestartFreshSessionClosesOldConnections | B；具体 backend 用户选择端到端待 main |
| 17 Closed 创建新 Mode | Rust lifecycle.rs::restart/start；restart_replaces_inner_and_old_clones_remain_closed_on_success_and_failure；Go lifecycle_test.go | B |
| 18 切换旧连接结束不重放、启动后恢复 | Rust lifecycle.rs/native_plane.rs/stream.rs；同上 clone 测试，Go TestRestartFreshSessionClosesOldConnections | B；宿主交接/长流设备场景未验收 |
| 19 新 start 失败/旧 close 未完 | Rust restart 先 close? 再替换；policy_lifecycle.rs 两个 restart 测试；Go TestRestartCloseFailureDoesNotStartReplacement / TestRestartNewStartFailureAndCancellation | B |
| 20 可能发送后不重放 | Rust http_proxy.rs::upstream_request_filter committed / error callbacks；http_proxy_tests.rs::business_websocket_rejection_is_not_replayed；Go TestHTTPPoolReuseAndNoReplayAfterCommit | B；所有 HTTP/TCP/WS 提交边界矩阵待 main |
| 21 Planner 纯内存输入 | Rust routing/tests.rs 借用 routes/health/Attempt；基线未可注入策略 | C → 本轮修复；运行留 main |
| 22 配置及绑定原入口 | Rust config/lifecycle；bindings/c/ts/swift/kotlin；Go 独立入口 | B；测试见前文，不把静态/源码当跨语言运行 |
| 23 取消/close 全部收敛 | Rust lifecycle/native_plane/probe/registry/tunnel；probe cancel_drains_running_and_queued_probes、tests/routes.rs canceled_start、registry.rs::dropping_bridge_connection_drains_half_open_upstream_before_sdk_close；Go review_regression_test.go / lifecycle_test.go | B；池、排队、backoff、长流全组合留 main |

## 剩余实现缺口与优先级

- P1，明确：§8 Rust 和独立 Go 的实例内网络变化生命周期；旧探测、测量、直连记录和池必须一起失效后重新检查。
- P1，明确：§2/10 ReverseBackend 身份差异和实际共享反代流程组合；现有两个布尔方法不足。
- P1，明确：§4/10 HTTP 与字节流小出口能力 / Executor 的组合；字节流仅包装 Backend，HTTP 直接 callbacks。
- P1，明确：§2/10 TunnelOutbound<T> 的协议能力替换边界；当前为具体结构和 enum。
- P2，待核实：独立 Go 下载 backend 能力差异、60 秒探测统计；DirectOutbound 地址选择策略的可替换要求；完整“拒绝业务出口仍探测”及恢复流共存场景。
- 本任务只补齐 Planner，不创建下一任务、不修改上述模块。

## 本轮 Planner 交付更新

- 最终候选：bfe9fcbf5b89e0ed59d938cae8465d5852898f83。基线以上仅修改 src/routing/filter.rs、select.rs、tests.rs；公开配置、Go、绑定与 wire 未改。
- §4/5/10 和 §12 场景 21 的 Planner 组合缺口从 C 更新为 A（仅源码组合及静态证据）；行为运行仍为 B，未宣称运行验收通过。
- CandidateFilter::allows 借用 Route / 单条 Health / Traffic / Attempt，并接收编号及统一 now；DefaultFilter 委托原资格 helper，再排除本次 tried。执行前 Registry::usable 的原 helper 逐字保留。
- NodeSelector::select 读取本层候选引用与 Health；DefaultNodeSelector 保持最少 failures、最快 20% 窗口和 host+session 哈希。Planner<F,N> 实际持有并调用两策略。
- Planner 固定 A→B→C→D。只有空候选层才继续；非空层的选择器拒绝选择或返回不在该层过滤结果中的编号时返回 NoEndpoint，不能借此跳层。
- 默认 routing::select 组装 Planner，依旧由调用侧更新 tried、取得 backend。Native 的 Backend::connect_observed → AttemptLoop 和 HTTP::upstream_peer 都继续调用该默认入口；短锁、执行前复查、统一 deadline 和 committed 不变。
- 增加四项测试源码：injected_filter_and_selector_borrow_candidates_with_fixed_tier_order、selector_cannot_return_filtered_tried_other_tier_or_unknown_indices_or_skip_a_tier、default_filter_preserves_health_capability_cooldown_expiry_and_attempt_boundaries、default_selector_keeps_inclusive_latency_window_and_unmeasured_fallback。基线已有 routing 测试断言保留，只替换默认 Planner 构造。
- 静态证据所属候选：cargo check --offline --locked --tests 成功退出，默认 features，耗时 1m28s（仅编译测试，不执行）；cargo fmt --all -- --check 和 git diff --check 成功；源码核对脚本对同一结构契约在基线报缺失、候选通过。
- cargo check 的警告位于未修改的 inspection_tests / inspection / managed_stream / tunnel_url / http_proxy_tests；没有本轮 routing 文件警告。不顺手修其他模块。
- 指定 codex / auto/gpt-6-astra / medium 唯一正式评审核对 bfe9fcb，对本次范围没有 blocker/major/minor；round 1 of 1 已登记在该提交。评审仍不是运行验收。
- PR 信息列在 proof 中。其他实现缺口按前文保留，不因本轮 Planner 完成而销项。

## Not proven

- 当前最终提交的所有行为测试，第 12 节完整矩阵、feature / race、跨语言与设备验收均未执行；遵守“dev 不回归，main 才回归”。
- 没有真实 Steam、节点连通、吞吐、证书/凭据、网络切换或设备证明。
- 静态检查、测试源码及 reviewer 阅读只证明其各自范围，不证明运行正确。
- 已明确的其他实现缺口仍然存在；等待 main 运行不能替代这些实现工作。
