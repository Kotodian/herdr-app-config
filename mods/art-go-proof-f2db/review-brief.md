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

- 用户明确 **不授权 commit、push、PR、merge、tag、部署**。因此变更全部未提交。这不是缺陷；请评审 `git diff fdd883aae27b5534426dd1dd11aedd28946603d7 -- bindings/go` **以及所有未跟踪的新文件**。不要提交，不要把 HEAD 当作已评审实现，不要创建代理。
- 只允许本次指定 reviewer。Review rounds 最多 1，Must fix blocker。请仍完整报告 major/minor，并明确证据及行号。
- 采用 `~/.config/herdr-core/templates/reviewer.md` 的只读评审规范。
- 测试需 local/fake，不访问 Steam/真实节点，不改系统代理/CA。模块纯 Go，CGO_ENABLED=0；race 需 CGO_ENABLED=1。

当前实现关键点（请核实，不要直接相信）：

- Mode 包装独立 session；公开方法先锁定并取得当前 session 指针。
- startup/后台使用独立 probe.go，通用 runner 不依赖 route/outbound。
- 手工固定连接执行一次 HTTP/1 交换；H2 直接 ClientConn.RoundTrip，无 Transport 自动重试循环。H1/H2 池在 pool.go，H2 多流共享连接，超时/取消只取消对应请求流。
- 新增测试含固定层级/同层回退、C-only、独立探测、共享预算、健康/generation、H1/H2 复用和提交后不重放、实际 HTTP2 REFUSED_STREAM/GOAWAY、HTTP经WSS+目标TLS、凭据隔离、Restart 失败/并发等。
- 基线相同测试 `/private/tmp/sps-2-proof/before.txt` 失败，当前 `/private/tmp/sps-2-proof/after.txt` 通过，证明启动资格行为修复。
- 本轮初步 `default.txt`、`race.txt` 和 `features.txt` 已通过；最近增加 TLS 快照和数据流反馈后仍会重跑全部检查。测试运行写 Go cache 并打开本地 socket，若只读 sandbox 限制，说明未运行，不要伪造结果或据此声称产品有 bug。

请把 findings 作为最后一条消息，不要只给计划，也不要修改任何文件。
