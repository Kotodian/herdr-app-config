# SPS-2：纯 Go SDK 路由、探测、健康与 Restart

完整设计：`/private/tmp/steam-sdk-routing-design-20261115.md`。请完整阅读，特别是第 12 节矩阵。

仓库：`__HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-2-go`。
基线：`fdd883aae27b5534426dd1dd11aedd28946603d7`（main）。
只有 `bindings/go/**` 可以修改；不允许改 Rust、其他绑定、根 README、构建脚本、部署。

用户要求实际实现并验证：

1. Routes 原生配置：显式 Payload、统一 Reverse 候选、Direct、Tunnel；保留旧配置和调用，离线验证 feature/backend/地址/凭据/CA，复制可变和敏感材料，错误与格式化不泄露 URL/凭据。
2. 固定 A Relay → B CDN → C Direct → D Tunnel。同层先最少连续接入失败，再 dial_elapsed EWMA 0.2/0.8，最快 20% 内目标+会话稳定哈希；同层失败先遍历同层。提交前过滤真实能力及已知下载不能使用的 CDN。
3. 独立 probe 仅通过 Dependencies.Dialer.DialContext 连接配置接入点并立即 Close；不经业务出口、不发 GET/HEAD、不访问 Steam。C 启动/后台不得解析或拨原站。
4. Start 总预算 15 秒，单 probe 3 秒，并发 3；汇总前不接受业务；部分失败不影响其他可用候选，C-only 可启动，无可用候选失败。取消、失败、Close 等待受控工作退出。
5. Available/Unavailable 两态；正常约 15 秒±20%，单接入点单在途；连续 3 次接入失败隔离，15/30/60/120 秒退避，连续 2 成功恢复，60 秒证据过期，generation 拒绝迟到反馈。区分接入、外层 TLS/凭据、目标冷却、业务状态、取消。TCP probe 不解除凭据/目标冷却，429 不重放。
6. 每次业务 Attempt 共用 deadline，涵盖 DNS/TCP/重试/TLS/握手/跨候选。业务头/正文可能发送、响应开始、升级/数据传输后，不得重放。必须检查 Go HTTP 自动重试边界。
7. C 保留域名映射和 TLS 身份，只在真实请求时解析/轮换 IP，并按目标+IP+generation 记录。D 支持 raw TCP 和 HTTP+正确上游 TLS，复用 SS/VLESS/XHTTP/WebSocket。池按出口/generation/TLS身份/authority/port/ALPN/connector 隔离，保留 H1 keepalive、H2 连接与多流复用；每个实际 HTTP 请求选路。
8. Restart(ctx,next Config)：调用方暂停交付并独占；离线验证先于旧 Close，旧 Close 失败不启动新；成功 Close 后换全新 session 并 Start；失败如实返回，不复制活动 mutex/WaitGroup，旧 goroutine 只引用旧 session。

授权边界：

- 用户最新授权：完成修复验证后提交，最终目标仅 dev。主目录的本地 dev 与基线 fdd883a 相同；Herdr 不支持对已建工作树改 base，因此 Assistant 要求暂缓 Ready、推送和 PR；不向 main 合并或发布。请评审 `git diff fdd883aae27b5534426dd1dd11aedd28946603d7 HEAD -- bindings/go`，包括本次 HEAD 中新增文件。不要编辑、提交、推送或创建代理。
- 此前未提交 diff 的预审为历史证据（review.txt）。正式第一轮审 24ed87f，结论为四项 major、无 blocker；已真实登记。Assistant 新增一轮，总计两轮；当前是最终提交的第二轮。Must fix blocker；请完整报告 major/minor，并明确证据及行号。
- 采用 `~/.config/herdr-core/templates/reviewer.md` 的只读评审规范。
- 测试需 local/fake，不访问 Steam/真实节点，不改系统代理/CA。模块纯 Go，CGO_ENABLED=0；race 需 CGO_ENABLED=1。

当前实现关键点（请核实，不要直接相信）：

- Mode 包装独立 session；公开方法先锁定并取得当前 session 指针。
- startup/后台使用独立 probe.go，通用 runner 不依赖 route/outbound。
- 手工固定连接执行一次 HTTP/1 交换；H2 直接 ClientConn.RoundTrip，无 Transport 自动重试循环。H1/H2 池在 pool.go，H2 多流共享连接，超时/取消只取消对应请求流。
- 新增测试含固定层级/同层回退、C-only、独立探测、共享预算、健康/generation、H1/H2 复用和提交后不重放、实际 HTTP2 REFUSED_STREAM/GOAWAY、HTTP经WSS+目标TLS、凭据隔离、Restart 失败/并发等。
- 基线相同测试 `/private/tmp/sps-2-proof/before.txt` 失败，当前 `/private/tmp/sps-2-proof/after.txt` 通过，证明启动资格行为修复。
- 预审发现八项问题：物理拨号取消/等待，VLESS 错误丢失，恢复饥饿，池满关闭当前 H2，拨号失败漏关请求体，Close 无法取消 Start，内部超时归因，Response.TLS。开发者已修复并补回归，请独立验证这些修复及整个设计范围。review-resolutions.txt 仅为开发者说明，不代表独立结论。
- 本轮最终 default.txt、race.txt、features.txt 和 all-features-race.txt 由开发者实际执行。测试运行写 Go cache 并打开本地 socket，若只读 sandbox 限制，说明未运行，不要伪造结果或据此声称产品有 bug。

请把 findings 作为最后一条消息，不要只给计划，也不要修改任何文件。

第二轮重点：第一轮四项 major 均已修复，须独立确认：

- VLESS establishmentScope 在成功握手后切换到长期流的实际请求 context；GOAWAY 后新物理拨号不再使用已取消的初始握手 context。tunnel_vless_goaway_test.go 用真实 TLS/H2 帧保持下载流，等待 GOAWAY 后 PING ACK，再验证新上传和原流下载。
- H2 retained 在 pool 锁内、发布指针之前设置，消除首次并发请求竞态。
- H2 StrictMaxConcurrentStreams 在 peer 限流时于同一连接排队；池过期排除 active/pending/reserved 流。pool_concurrency_test.go 强制 peer 最大单流，先 acquire 两次再同时提交，并测试 24 个冷启动请求与单流取消。
- VLESS 上传 401/403 在读 body 前立即隔离；成功响应 drain 限 4096 字节并受单包 timeout 控制，传播读取错误。身份表新增服务器发拒绝头后不结束 body 的 TCP/HTTP 入口案例。
- final-review-before.txt 是新增测试在修复前的实际失败；final-review-after.txt 是修复后的对应 race 通过。完整矩阵输出已刷新，请核实最终 SHA。
