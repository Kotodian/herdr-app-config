# SPS-8 需求与验收台账

核对日期：2026-11-16。实际基线 dev/origin/dev/task/8-go 为 24707ae，包含 SPS-6 的 d8ca233 和 SPS-7 的 24707ae。原设计全文通过 Obsidian CLI 读取，与 20261115 快照一致。已读 SPS-6/SPS-7 最终 ledger、review 与 proof 记录。前序候选 SHA 与 squash 合入 SHA 区分保留。

范围：同实例网络变化的 Rust/独立 Go 交付、Go 下载能力与近期探测统计；保留前序 Planner/出口组合。公开配置、C/TS/Swift/Kotlin wire/ABI、依赖、离线工具、部署均未改。没有创建其他开发任务或开发代理。

状态：A 仅指源码事实/静态证据；B 表示有实现但运行未验收；C 为明确实现缺口；D 为尚待核实。以下新增测试都只是源码；本轮不运行 Rust/Go 测试、race、feature 回归矩阵、设备、真实节点或 Steam 请求。

最终交付：19335d7df9c737f7a01fbd554327d0778222e394；PR #8，task/8-go → dev，未合并。当前 SHA 的 cargo check --offline --locked --tests、cargo fmt --all -- --check、Go go test -c、gofmt 和 git diff --check 均真实通过。检查输出、源码哈希见 checks-summary.json 及日志；未执行任何测试 binary/init。

唯一正式评审：指定 codex / auto/gpt-6-astra / medium 以只读模式在同一轮核对先前交付 SHA 67145a825b263e47a2953c2e94d7fb65bed62fb2，无 blocker/major。初次启动预算、HTTP 提交边界和连续事件回收问题，以及同轮后续 H2 DATA 写锁问题均在源码中修正。minor 为临时 diff 文件曾只有 diffstat：已补完整 patch，并独立逐字节与 Git 输出比对。保留 reviewer 原始结论及当时证据处置于 review.txt。当前后续用户修改提交不冒充已获该 reviewer 复审；按用户要求更新 Ready，由人重新审核新 diff。评审不构成运行验收。

## 用户评审意见 3afaeef0c910

- 意见：network_change.go:37 的平台判断为什么不在编译期处理。
- 说明：原 runtime.GOOS 已是编译目标常量，switch 不是动态 OS 检测；但将不同平台的系统访问代码集中在共用文件不够清晰。按意见改为编译期文件选择，移除共用文件中的平台 switch 和 runtime 导入。
- 实现：network_change_linux.go 仅 Linux；network_change_darwin.go 仅 macOS；network_change_supported.go 共享接口快照与排序；network_change_unsupported.go 保留其他平台默认源不可用的返回。NetworkObserver 宿主注入优先级不变。
- 保留 Android/iOS 原不提供默认源的范围：Go 将它们分别同时匹配 linux/darwin，故显式 !android / !ios，兜底约束包含 android / ios。
- 验证：实际 go list 静态选择 Linux/macOS 对应实现，Windows/Android/iOS 仅兜底；新增 Linux 与 Windows 兜底 helper 独立编译通过，本机完整 Go 测试源码编译通过。完整原始命令、退出码与选中文件见 platform-selection.json。这不是平台运行回归或设备验收。

## 网络事件到资源收敛的实际链路

- Rust：NativePlane::start → prepare → choose_backend → prepare_routes。启动前取得网络身份，tasks.spawn(network_change::watch) 每秒比较稳定快照，watch::Sender 合并重复/连续快照。maintain_routes 同时等变更、启动 deadline、取消及 check_routes；事件先 Registry::invalidate，取消并等待旧 ProbeScheduler 的在途和排队任务，再 build_routes 新代。新 Registry 继承凭据/证书隔离及未过期目标冷却，重建 DirectOutbound 和 TunnelOutbound，发布 root.current 的新快照；同一 SDK session 的哈希种子保留。
- Rust 业务：Backend::connect_observed / HTTP::upstream_peer 取得当代 Registry。未提交获取由 acquisition token 取消；HTTP commit 在短健康读锁内与 invalidate 排序。RequestContext 绑定当代反馈，DNS 缓存和 Pingora group_key 含当代身份；GenerationStream/HTTP token 保持旧业务出口存活。旧代 active 为空后关闭能力、桥接及直连历史；根 HTTP 池的旧 key 不供新操作使用，空闲连接沿原 30 秒超时或实例关闭回收。此处不声称所有旧 Pingora idle socket 都在事件瞬间关闭。
- Go：Start 在共享启动预算内读取身份并启动 watchNetwork，单元素 changes channel 只保存最新事件。Start/probeLoop 收到事件，取消并等待旧探测，再 resetNetwork，新建候选、accessHealth、直连历史和隧道。blocked 和未过期 cooldowns 保留，session seed 不变，networkCtx 只限制获取/未提交队列。
- Go 业务：选中 route 的 immutable generation 决定拨号、反馈及 poolKey；context.AfterFunc 取消未完成 dial/TLS/H2 preface。HTTP/2 有连接私有、可取消的写头准入门，使用非 StrictMaxConcurrentStreams 的 CanTakeNewRequest 读取容量，不调用会等待写锁的 State；取得资格后，HTTP/1 与 HTTP/2 都通过 commitRequest 在短健康锁内与网络 invalidate 排序并解除网络取消，再开始可能发送的写入。WroteHeaders 只释放写头门，不再作为提交边界。未提交的队列可取消，已提交的写头、响应和流保留。routeConnection 的 users 使旧隧道等待其活动连接结束。pool.advance 排除旧 key 和迟到归还；旧 H2 活动连接由 SDK 请求持有计数保留，在错误清理或响应体关闭后释放，等全部活动请求结束再回收。池推进/取用/过期都不调用 State，不等待旧 HEADERS/DATA/control 写入锁。
- 关闭：Rust Session 取消、关 socket，等待 TaskTracker 内观察/维护/探测与代际清理；Go Close 取消、关资源/池，等待 work 后关闭当前/旧代出口。退休 Go tunnel 的关闭错误会保留重试并返回 Close，不把未完成清理误报成功。restart 仍先等旧实例 Close，再新建；不改变旧 clone/owner 契约。

## 默认事件与宿主边界

| 实现 | 默认入口 | 可替换边界 | 支持范围与限制 |
| --- | --- | --- | --- |
| Rust | network_change::revision：Linux /proc/net 路由、IPv6 地址、fib_trie、resolv.conf；macOS 本机 route/ifconfig | 既有 TcpDialer 默认方法 network_revision()，可覆盖返回稳定身份或 None | 仅 Linux/macOS 本机快照字段变化；macOS DNS 未完整接入；Windows/iOS/Android 等无默认源 |
| Go | localNetworkRevision：Linux 接口/地址、路由与 resolv.conf；macOS 接口/地址与 route 默认网关 | 宿主 Dialer 可实现 NetworkObserver.NetworkRevision(ctx)；否则用本机源 | 同网关同地址的 Wi-Fi 切换、所有 VPN/DNS 变化、轮询之间的瞬变不保证检测；其他平台无默认源 |

两者均每秒本机取样；读取失败保留上次可读身份，不把失败伪造成网络已变化。宿主源必须可取消且不主动连接 Steam/业务目标。没有新切线控制 API，不修改系统路由、代理、证书或外部探测服务。默认源的真实 OS 行为留待 main/设备验收。

## Rust / Go 行为映射与真实局限

| 契约 | Rust | Go | 判定 |
| --- | --- | --- | --- |
| generation 与迟到结果 | 新 Registry/Backend/DirectOutbound；旧快照失去资格与反馈写入资格 | route.generation、accessHealth.generation、新 route/access；所有业务反馈检查代际及取消 | A（源码）、B（运行） |
| 探测范围/并发 | group_targets、ProbeScheduler、TcpProbe；3 并发/3 秒/15 秒 | probeRunner/ProbeLoop；相同接入共享 access，最多 3 在途 | A/B；跨 SDK 实例的进程级总限额未实现，既有语义是实例级 |
| 60 秒统计 | Health.samples/cancellations；业务 Access 不再混入 probe 样本，最多 256；定时 prune | accessHealth.samples/cancellations；实际 probeResult.completed，最多 256；定时 prune | A/B；取消不计完成/成功分母；旧代状态丢弃 |
| dial_elapsed | 成功 Probe 的总拨号耗时与 EWMA | 同上；业务成功不更新探测 EWMA | A/B；不是 RTT/丢包率，未造细分测量 |
| 诊断消费 | 窗口仅在内部 Health；Observer 仍是实际阶段/业务事件 | 窗口仅在内部 accessHealth；Status 不导出窗口 | D：两者都没有近期成功比例的公开诊断消费链；不引入平台或评分算法 |
| 归因保留 | isolated/targets 继承；TCP 成功不清业务隔离 | blocked/cooldowns 继承；旧代/取消不改新健康 | A/B |
| 池与既有流 | snapshot group key/DNS 身份；旧活动 token 保留 | immutable route poolKey、retired H2、route users | A/B；完整并发运行、关闭和 XHTTP 长载流未运行 |

## Backend 与下载/载荷资格

| backend | 层级 | Rust | 独立 Go | 下载资格 |
| --- | --- | --- | --- | --- |
| Relay | A | HTTP 远端反代 | HTTP 远端反代 | 允许 |
| CloudflareWorker | B | HTTP 反代 | HTTP 反代 | 禁止已识别下载 |
| EdgeOne | B | HTTP 反代 | HTTP 反代 | 禁止已识别下载 |
| EdgeOneOrigin | B | HTTP 反代，保留实际身份/头规则 | HTTP 反代，原 serverName/头规则保留 | 允许；Go 从按 B 全禁改为按 backend 能力 |
| Direct | C | 原始 TCP/HTTP；只真实业务解析地址 | 同上 | 允许符合 payload 的业务 |
| Tunnel | D | VLESS/XHTTP、WSS、SS 依编译能力；HTTP 内层 TLS/authority | 同上，依 Go 编译标签 | 允许符合 payload 的业务 |
| EdgeOneWebSocket | backend 的 B | TCP 载荷，HTTP 配置归一化过滤 | 当前 Go 无该反代枚举/配置；WSS 隧道不等于该 backend | Go 未新增配置或冒充支持；Rust 按真实 TCP 能力 |

## 全章节当前状态

| 章节 | 当前实现/静态证据 | 测试源码与未运行项 |
| --- | --- | --- |
| §1 接口与宿主 | 原 Factory/生命周期/注入保留；增加兼容的 dialer 身份观察边界 | 原生命周期/连接入口测试保留；宿主设备仍 B/D |
| §2 能力与固定层级 | 前序反代/隧道组合保留；Go 下载按 backend 修正，TCP 仍过滤 HTTP 反代 | TestDownloadEligibilityUsesBackendCapability；原排序/协议测试保留，运行 B |
| §3 配置 | Rust/Go 配置、wire、ABI 未变；无切线 API | 原配置与绑定测试源码保留，运行 B |
| §4 职责/组合 | native 组装事件；registry 管代际资源；health 归因；probe 独立；Planner 主体未改 | 前序策略/出口替换测试保留，运行 B |
| §5 状态/锁 | 当代快照/immutable route；健康短锁；事件读取、协议准备与清理不持健康长锁 | 并发安全运行 B；既有 HTTP DNS cache 锁模式未重写 |
| §6/6.1 独立 Probe | 仅接入点，保留 total dial 成本；旧探测取消后等待再重新调度 | 新网络启动在途用例；原 EOF/无业务写入测试，运行 B |
| §6.2 调度/恢复 | 旧代在途/队列先收敛，新代首次有界资格检查，后续沿既有阈值/退避 | 原公平/超时/恢复测试及新增取消/重复事件源码，运行 B |
| §6.3 指标 | 两者均有独立 60s completed/success 窗口及取消计数，最多256；同层评分规则不变 | Rust recent_probe_window_excludes_business_cancellation_and_old_generation、Go TestRecentProbeWindowCancellationAndBusinessSeparation，运行 B；公开诊断 D |
| §7 Start | 身份读取与连续事件共享启动预算；未汇总不发布业务资格；C 无原站探测 | Rust/Go 网络变化中启动、原 startup_contract 测试，运行 B |
| §8 健康/网络 | 原 C 网络整链缺口已补齐为 A（源码）/B（运行），不是靠 restart；隔离/冷却跨网络保留 | 见下新增源码；真实网络恢复与设备 D |
| §9 Restart | 公共方法不变，Close 等待本实例新增观察/代际维护 | 原生命周期/restart 测试保留，设备交接 B/D |
| §10 协议/池 | 复用前序 NativeStream/NativeHttp/Tunnel；每代重新组装，TLS/authority/ALPN/connector 隔离 | 新网络 HTTP 池测试；原 C/D TLS/池与替换隧道测试，运行 B |
| §11 预算/提交 | 不跨候选重放；HTTP2 写头前队列可取消，已提交继续；原共享业务 deadline 保留 | 原 no-replay/预算测试、新旧 H2 流源码，运行 B |
| §12 落点/验收 | routing/outbound/health/probe 原职责与接口保留；报告仅临时目录/proof | 全部场景逐项如下；无业务运行通过结论 |

## 第 12 节全部场景台账

1. Relay/CDN 同配：前序共享反代保持，A 优先 B。A 源码/B 运行；原固定层级测试。
2. A1 失败先 A2：Planner 未改；原 fixed_tiers / Go fallback 测试。B。
3. 40/45/10ms 稳定分配：session seed 跨网络保留，仅新测量重新比较；原选择测试。B。
4. 慢 DNS/轮换 dial：实际 probe 总成本/计时保留；Go completed 单独记录，非 RTT。B，专门慢 DNS 组合运行待核实。
5. 单次失败/连续阈值：原算法保留；样本统计不替代熔断。B。
6. A 不可用逐级 B/C/D：固定层级不改。B。
7. TCP 过滤 HTTP backend：保留；Go EdgeOneWebSocket 缺少原配置能力明确列出，未新增 wire。B/D。
8. Start 部分超时：共享总预算，变更取消旧 probe 后收齐新代结果。新网络启动测试源码，B。
9. 只 C 零原站探测：新增 Rust native_network_event_keeps_committed_stream_resets_history_and_stops_subscription；Go TestNetworkChangeDirectOnlyKeepsStreamAndClearsHistoryAndStopsObserver。B。
10. 全部无资格：原 NoEndpoint/ErrNoAvailableRoute 保留；凭据隔离不能被网络刷新洗掉。B。
11. 只探接入点：新增 Rust network_event_during_start_drains_old_probe_and_rechecks_only_access；Go TestNetworkChangeDuringStartDrainsOldProbeAndPreservesIsolation。B。
12. 全业务出口拒绝仍 probe：SPS-7 的 startup_probe_works_with_every_http_and_stream_outlet_replaced_by_refusal 保留。A（源码）/B（运行）。
13. TCP 成功不清凭据/429：新网络继承 isolation/cooldowns；原 HTTP429/凭据测试及新网络测试源码。B。
14. 冷却/C 地址/网络变化：原网络实现 C 更新为 A（已接线源码）/B（未运行）；原站不主动探测，旧反馈不能覆盖新健康。
15. 高优先级恢复、新旧流：层级算法保留；新增原始 TCP 和 H2 的网络代际流共存源码。B；完整 A 恢复时流共存仍 D。
16. 用户选择 B1 restart：原类型/owner/Close-before-Start 保留。B。
17. Closed 新 Mode：原生命周期逻辑保留。B。
18. 旧连接结束不重放、新启动交接：restart 原行为保留，新增观察/代际任务随 Close 收敛。B；宿主交接未运行。
19. 新 start失败/旧 Close未完：原失败状态/重试 Close 保留，退休 Go 出口关闭错误不丢弃。B。
20. 可能发送后不重放：原边界保留；网络事件只取消未提交获取/排队。B；新增 TestNetworkChangePreservesCommittedHTTP2BodyAndSeparatesNewPool。
21. Planner 纯内存输入：SPS-6 组合保持，未重写 Planner。A（源码）/B（运行）。
22. 原配置/语言入口：Rust/Go 入口兼容；C/TS/Swift/Kotlin wire 未改。B；跨语言/设备 D。
23. cancel/Close全收敛：观察、探测、排队、旧代出口/池都接入本实例任务/资源归属。新增实际 NativePlane Close 和 Go Close 源码，原关闭/取消测试保留。B，完整并发 race/长载流运行 D。

## 本轮新增测试源码索引

- Rust：native_network_event_keeps_committed_stream_resets_history_and_stops_subscription；network_event_during_start_drains_old_probe_and_rechecks_only_access；network_event_makes_subsequent_http_use_a_new_pool_and_ignores_old_feedback；recent_probe_window_excludes_business_cancellation_and_old_generation；startup_budget_settles_slow_remotes_and_keeps_local_direct_available；sustained_changes_reap_inactive_generations_without_waiting_for_probe_completion。
- Go：TestNetworkChangeDirectOnlyKeepsStreamAndClearsHistoryAndStopsObserver；TestNetworkChangeDuringStartDrainsOldProbeAndPreservesIsolation；TestNetworkPoolRejectsLateReturnsAndNewOperations；TestNetworkChangePreservesCommittedHTTP2BodyAndSeparatesNewPool；TestRecentProbeWindowCancellationAndBusinessSeparation；TestDownloadEligibilityUsesBackendCapability；TestRequestCommitOrdersNetworkInvalidationWithoutHoldingLockDuringWrite；TestHTTP2HeaderQueueCancellationDoesNotEnterCommit；TestNetworkInvalidationDuringCommittedHTTP2HeaderWriteDoesNotCancelStream；TestHeldHTTP2DataWriteDoesNotBlockCanceledAdmissionOrNetworkRequalification（挂起真实 TLS DATA 写入；未提交准入取消、容量读取、新代探测和请求须在释放旧写入前完成）。
- source audit 对同一源码契约比较基线/候选，只证明静态结构缺失→存在，不是 bug 的行为复现通过。行为复现/验证遵用户要求留 main。

## 仍未满足/尚待核实与 main 运行验收

- 明确实现覆盖限制：默认网络源只有 Linux/macOS 的所述快照字段；其他 OS 需宿主 Dialer 身份源，不声称所有平台自动订阅。
- 明确能力差距：Go 未有 EdgeOneWebSocket 反代 backend；现有公开配置不包含它，本轮不扩配置。Rust 该 backend 是 TCP，不能当普通 HTTP；WSS tunnel 各自保持。
- 明确未有公开消费：Rust/Go 的近期 probe 窗口都没有公开诊断导出/成功率展示；首字节、正文吞吐、缓存/复用的完整诊断消费链仍需进一步核实，不宣称监控完成。
- 待核实：DirectOutbound 独立地址选择策略是否要求进一步抽离；当前 S 仍是 TcpDialer，地址算法固定，未扩大为 Planner/协议重写。
- 待核实：全实例级与进程级“全局 3 并发”含义；当前每 SDK 实例 3，不承诺所有实例共用进程配额。
- main 待授权：运行所有新旧 Rust/Go 测试、race、feature/平台/绑定矩阵；真实网卡/路由/VPN变化、Start/Close/Restart竞态、连续事件、XHTTP上传及已有 H2/TCP长流；真实节点/Steam/证书与吞吐。静态编译、源码台账和评审均不能代替运行。

## Not proven

- 本轮没有执行任何 Rust/Go 测试 binary 或 init，没有回归/race/feature矩阵，没有设备、真实节点或 Steam 请求。
- 默认 OS 网络观察的运行效果、真实业务无损、池收敛/队列/后续 XHTTP carrier 的全部竞态均未运行验收。
- 本文 A 不表示业务验收；B/D 留待 main 阶段授权。上述明确实现差距不能由静态检查或等待 main 测试自动销项。
