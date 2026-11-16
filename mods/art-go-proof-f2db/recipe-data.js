// Written by herdr-artifact from recipe.json.
export default {
  "recipe": 1,
  "blocks": [
    {
      "type": "text",
      "md": "纯 Go SDK 已加入固定优先级多出口路由、独立接入探测、健康恢复和 Restart。\n旧调用保留，H1 keepalive 与 H2 多流复用继续工作，业务提交后不重放。\n所有变更保留未提交，等待提交/推送授权。"
    },
    {
      "type": "stats",
      "items": [
        {
          "label": "纯 Go",
          "value": "通过",
          "note": "CGO_ENABLED=0"
        },
        {
          "label": "Race",
          "value": "通过",
          "note": "默认与全部协议"
        },
        {
          "label": "Tag 组合",
          "value": "9",
          "note": "全部测试通过"
        }
      ]
    },
    {
      "type": "heading",
      "level": 2,
      "text": "同一个启动回归：修改前与修改后"
    },
    {
      "type": "text",
      "md": "真实执行同一份测试：底层 dialer 模拟接入拒绝。基线没有拨接入点却返回 Running；当前必须探测并返回失败。"
    },
    {
      "type": "text",
      "md": "修改前：基线 fdd883a 的实际输出，失败是预期的缺陷复现。"
    },
    {
      "type": "code",
      "lang": "text",
      "text": "=== RUN   TestStartupAccessQualificationBeforeRunning\n    startup_contract_test.go:27: unreachable access point published: err=<nil> state=running access_dials=0\n--- FAIL: TestStartupAccessQualificationBeforeRunning (0.00s)\nFAIL\nFAIL\tgithub.com/gamesir123/steam-proxy\t0.437s\nFAIL"
    },
    {
      "type": "text",
      "md": "修改后：同一份 TestStartupAccessQualificationBeforeRunning 实际通过。"
    },
    {
      "type": "code",
      "lang": "text",
      "text": "=== RUN   TestStartupAccessQualificationBeforeRunning\n--- PASS: TestStartupAccessQualificationBeforeRunning (0.00s)\nPASS\nok  \tgithub.com/gamesir123/steam-proxy\t0.420s"
    },
    {
      "type": "heading",
      "level": 2,
      "text": "最终验证"
    },
    {
      "type": "text",
      "md": "默认纯 Go 全套：GOWORK=off CGO_ENABLED=0 go test ./..."
    },
    {
      "type": "code",
      "lang": "text",
      "text": "ok  \tgithub.com/gamesir123/steam-proxy\t0.801s"
    },
    {
      "type": "text",
      "md": "默认 race 全套：GOWORK=off CGO_ENABLED=1 go test -race ./..."
    },
    {
      "type": "code",
      "lang": "text",
      "text": "ok  \tgithub.com/gamesir123/steam-proxy\t2.320s"
    },
    {
      "type": "text",
      "md": "显式能力与组合：下列九个 CGO_ENABLED=0 tag 构建和对应测试全部通过。"
    },
    {
      "type": "code",
      "lang": "text",
      "text": "GOWORK=off CGO_ENABLED=0 go test -timeout 60s -tags reverse_proxy ./...\nok  \tgithub.com/gamesir123/steam-proxy\t0.939s\nGOWORK=off CGO_ENABLED=0 go test -timeout 60s -tags vless_xhttp ./...\nok  \tgithub.com/gamesir123/steam-proxy\t0.416s\nGOWORK=off CGO_ENABLED=0 go test -timeout 60s -tags websocket ./...\nok  \tgithub.com/gamesir123/steam-proxy\t0.402s\nGOWORK=off CGO_ENABLED=0 go test -timeout 60s -tags shadowsocks ./...\nok  \tgithub.com/gamesir123/steam-proxy\t0.375s\nGOWORK=off CGO_ENABLED=0 go test -timeout 60s -tags tunnel_proxy ./...\nok  \tgithub.com/gamesir123/steam-proxy\t0.358s\nGOWORK=off CGO_ENABLED=0 go test -timeout 60s -tags reverse_proxy,vless_xhttp ./...\nok  \tgithub.com/gamesir123/steam-proxy\t0.999s\nGOWORK=off CGO_ENABLED=0 go test -timeout 60s -tags reverse_proxy,websocket ./...\nok  \tgithub.com/gamesir123/steam-proxy\t1.019s\nGOWORK=off CGO_ENABLED=0 go test -timeout 60s -tags reverse_proxy,shadowsocks ./...\nok  \tgithub.com/gamesir123/steam-proxy\t0.945s\nGOWORK=off CGO_ENABLED=0 go test -timeout 60s -tags reverse_proxy,vless_xhttp,websocket,shadowsocks ./...\nok  \tgithub.com/gamesir123/steam-proxy\t0.986s"
    },
    {
      "type": "text",
      "md": "全部具体协议同时启用的 race 测试。"
    },
    {
      "type": "code",
      "lang": "text",
      "text": "ok  \tgithub.com/gamesir123/steam-proxy\t2.297s"
    },
    {
      "type": "text",
      "md": "本次验证的实际工具链。"
    },
    {
      "type": "code",
      "lang": "text",
      "text": "go version go1.27.3 darwin/arm64"
    },
    {
      "type": "heading",
      "level": 2,
      "text": "行为证据"
    },
    {
      "type": "table",
      "columns": [
        "范围",
        "验证方式"
      ],
      "rows": [
        [
          "A → B → C → D、同层失败回退、EWMA/稳定分配",
          "纯策略测试 + 本地 TLS 反代；A1 拨号失败后只请求 A2，B 更快也不越级"
        ],
        [
          "独立 probe、启动预算、取消收敛",
          "fake dialer 检查接入地址、零应用写入和立即关闭；synctest 检查 15 秒/3 秒/并发 3"
        ],
        [
          "C 不主动连接原站",
          "C-only 启动及后台检查，dialer/resolver 调用必须为零；真实业务才解析/轮换 IP"
        ],
        [
          "HTTP 复用与无重放",
          "本地 H1/H2 服务重复使用连接；提交后断开、REFUSED_STREAM、GOAWAY 均无追加请求"
        ],
        [
          "每请求选路与 H2 取消",
          "同一客户端连接按 A/B/A 处理请求；并行 H2 请求共用上游，取消一条流不关闭其他流"
        ],
        [
          "D 的 HTTP/TLS 与凭据隔离",
          "本地 WSS 节点转发到本地 TLS 原站；正确 SNI/authority、连接复用；401 后 TCP probe 不解除隔离"
        ],
        [
          "Restart 所有权与失败路径",
          "离线失败保留旧会话，Close 失败不启动新会话，成功换全新 session，取消/新 Start 失败如实返回"
        ]
      ]
    },
    {
      "type": "details",
      "summary": "展开本次行为测试的实际输出",
      "blocks": [
        {
          "type": "text",
          "md": "以下包含本地真实 HTTP/TLS/WSS 与 HTTP/2 帧测试，也包含明确标注的 fake dialer 和虚拟时钟测试。TLS EOF 日志来自仅 TCP 建连后立即关闭的 probe，不是 HTTP 健康请求。"
        },
        {
          "type": "code",
          "lang": "text",
          "text": "=== RUN   TestRestartValidationFailurePreservesOldSession\n--- PASS: TestRestartValidationFailurePreservesOldSession (0.00s)\n=== RUN   TestRestartCloseFailureDoesNotStartReplacement\n--- PASS: TestRestartCloseFailureDoesNotStartReplacement (0.00s)\n=== RUN   TestRestartFreshSessionClosesOldConnections\n--- PASS: TestRestartFreshSessionClosesOldConnections (0.00s)\n=== RUN   TestRestartNewStartFailureAndCancellation\n=== RUN   TestRestartNewStartFailureAndCancellation/unreachable\n=== RUN   TestRestartNewStartFailureAndCancellation/cancelled\n--- PASS: TestRestartNewStartFailureAndCancellation (0.00s)\n    --- PASS: TestRestartNewStartFailureAndCancellation/unreachable (0.00s)\n    --- PASS: TestRestartNewStartFailureAndCancellation/cancelled (0.00s)\n=== RUN   TestRestartAndConcurrentStatusClose\n--- PASS: TestRestartAndConcurrentStatusClose (0.00s)\n=== RUN   TestStartupBudgetAndCancellationWaitForAllProbes\n--- PASS: TestStartupBudgetAndCancellationWaitForAllProbes (0.00s)\n=== RUN   TestProbeRunnerConcurrencyTimeoutAndCancellation\n--- PASS: TestProbeRunnerConcurrencyTimeoutAndCancellation (0.00s)\n=== RUN   TestHTTPPoolReuseAndNoReplayAfterCommit\n=== RUN   TestHTTPPoolReuseAndNoReplayAfterCommit/h1/GET\n=== RUN   TestHTTPPoolReuseAndNoReplayAfterCommit/h1/POST\n=== RUN   TestHTTPPoolReuseAndNoReplayAfterCommit/h2/GET\n=== RUN   TestHTTPPoolReuseAndNoReplayAfterCommit/h2/POST\n--- PASS: TestHTTPPoolReuseAndNoReplayAfterCommit (0.01s)\n    --- PASS: TestHTTPPoolReuseAndNoReplayAfterCommit/h1/GET (0.00s)\n    --- PASS: TestHTTPPoolReuseAndNoReplayAfterCommit/h1/POST (0.00s)\n    --- PASS: TestHTTPPoolReuseAndNoReplayAfterCommit/h2/GET (0.00s)\n    --- PASS: TestHTTPPoolReuseAndNoReplayAfterCommit/h2/POST (0.00s)\n=== RUN   TestHTTPBusinessFallbackTriesA2BeforeFasterB\n--- PASS: TestHTTPBusinessFallbackTriesA2BeforeFasterB (0.00s)\n=== RUN   TestHTTPSelectionIsPerRequestOnOneDownstreamConnection\n2026/11/15 23:55:55 http: TLS handshake error from 127.0.0.1:50413: EOF\n2026/11/15 23:55:55 http: TLS handshake error from 127.0.0.1:50412: EOF\n--- PASS: TestHTTPSelectionIsPerRequestOnOneDownstreamConnection (0.00s)\n=== RUN   TestHTTP2MultiplexesWithoutSharingRequestCancellation\n2026/11/15 23:55:56 http: TLS handshake error from 127.0.0.1:50419: EOF\n--- PASS: TestHTTP2MultiplexesWithoutSharingRequestCancellation (0.00s)\n=== RUN   TestHTTP2RefusedStreamAndGoAwayDoNotReplay\n=== RUN   TestHTTP2RefusedStreamAndGoAwayDoNotReplay/REFUSED_STREAM\n=== RUN   TestHTTP2RefusedStreamAndGoAwayDoNotReplay/GOAWAY\n--- PASS: TestHTTP2RefusedStreamAndGoAwayDoNotReplay (0.00s)\n    --- PASS: TestHTTP2RefusedStreamAndGoAwayDoNotReplay/REFUSED_STREAM (0.00s)\n    --- PASS: TestHTTP2RefusedStreamAndGoAwayDoNotReplay/GOAWAY (0.00s)\n=== RUN   TestDirectOnlyStartAndBackgroundNeverDialOrigin\n--- PASS: TestDirectOnlyStartAndBackgroundNeverDialOrigin (0.00s)\n=== RUN   TestHTTPOverWSSTunnelVerifiesOriginTLSAndReusesConnection\n=== RUN   TestHTTPOverWSSTunnelVerifiesOriginTLSAndReusesConnection/legacy\n2026/11/15 23:55:56 http: TLS handshake error from 127.0.0.1:50427: EOF\n=== RUN   TestHTTPOverWSSTunnelVerifiesOriginTLSAndReusesConnection/routes\n2026/11/15 23:55:56 http: TLS handshake error from 127.0.0.1:50432: EOF\n--- PASS: TestHTTPOverWSSTunnelVerifiesOriginTLSAndReusesConnection (0.01s)\n    --- PASS: TestHTTPOverWSSTunnelVerifiesOriginTLSAndReusesConnection/legacy (0.00s)\n    --- PASS: TestHTTPOverWSSTunnelVerifiesOriginTLSAndReusesConnection/routes (0.00s)\n=== RUN   TestTunnelCredentialsRemainIsolatedAfterTCPProbeSuccess\n2026/11/15 23:55:56 http: TLS handshake error from 127.0.0.1:50436: EOF\n2026/11/15 23:55:56 http: TLS handshake error from 127.0.0.1:50438: EOF\n2026/11/15 23:55:56 http: TLS handshake error from 127.0.0.1:50439: read tcp 127.0.0.1:50435->127.0.0.1:50439: use of closed network connection\n--- PASS: TestTunnelCredentialsRemainIsolatedAfterTCPProbeSuccess (0.00s)\nPASS\nok  \tgithub.com/gamesir123/steam-proxy\t0.233s"
        }
      ]
    },
    {
      "type": "heading",
      "level": 2,
      "text": "差异与评审"
    },
    {
      "type": "text",
      "md": "新增 API：`Config.Routes`、`Routes`、`ReverseRoute`、`PayloadHTTP/PayloadTCP`、`Dependencies.Resolver` 和 `Mode.Restart(ctx, nextConfig)`。完整配置和所有权说明在 bindings/go/README.md。"
    },
    {
      "type": "details",
      "summary": "变更范围与空白检查",
      "blocks": [
        {
          "type": "code",
          "lang": "text",
          "text": "git diff --check: exit 0\nChanged/new files: 27\nbindings/go/README.md\nbindings/go/config.go\nbindings/go/config_test.go\nbindings/go/connection.go\nbindings/go/connection_reverse.go\nbindings/go/connection_reverse_disabled.go\nbindings/go/connection_test.go\nbindings/go/http.go\nbindings/go/identity.go\nbindings/go/identity_reverse.go\nbindings/go/mode.go\nbindings/go/test_helpers_test.go\nbindings/go/tunnel.go\nbindings/go/tunnel_vless.go\nbindings/go/tunnel_wss.go\nbindings/go/lifecycle.go\nbindings/go/lifecycle_test.go\nbindings/go/pool.go\nbindings/go/pool_test.go\nbindings/go/probe.go\nbindings/go/probe_test.go\nbindings/go/routes_config.go\nbindings/go/routing.go\nbindings/go/routing_http_test.go\nbindings/go/routing_test.go\nbindings/go/startup_contract_test.go\nbindings/go/tunnel_http_test.go"
        }
      ]
    },
    {
      "type": "callout",
      "tone": "info",
      "title": "独立评审进行中",
      "md": "指定 reviewer 正在检查未提交差异。完成后更新此处，当前不冒充已评审提交。"
    },
    {
      "type": "heading",
      "level": 2,
      "text": "Not proven"
    },
    {
      "type": "list",
      "items": [
        "未访问 Steam、真实 Relay/CDN/隧道节点；本次证明 SDK 的本地行为，不证明生产连通性、吞吐或供应商部署。",
        "未修改系统代理、CA 信任或平台接管规则；这些仍由宿主管理。",
        "未执行跨平台设备测试或生产长时间故障演练；启动时序使用受控虚拟时钟验证。",
        "当前 Go 绑定没有 EdgeOneWebSocket 反代 backend；不伪造此协议能力，WSS 隧道仍可用。",
        "未 commit、push、PR、merge、tag 或部署。未提交代码不登记为已评审 commit，也未标记 Ready/Done。"
      ]
    }
  ]
};
