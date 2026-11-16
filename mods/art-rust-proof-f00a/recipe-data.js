// Written by herdr-artifact from recipe.json.
export default {
  "recipe": 1,
  "blocks": [
    {
      "type": "text",
      "md": "Rust SDK 已加入多候选路由、独立接入探测、健康与重试策略，以及可失败的实例重启。\nHTTP 请求各自选路，直连和隧道复用现有 Pingora，并保留实际目标的 TLS 身份。\n所有改动保留在 SPS-1 工作树，尚未提交或推送。"
    },
    {
      "type": "stats",
      "items": [
        {"label": "默认测试", "value": "94", "note": "全部通过"},
        {"label": "完整传输组合", "value": "100", "note": "全部通过"},
        {"label": "独立只读评审", "value": "1", "note": "阻断项已修复"}
      ]
    },
    {
      "type": "text",
      "md": "证明一：本次工作实际运行的特性矩阵；全部使用离线依赖、本地服务或假 dialer，没有访问 Steam。"
    },
    {
      "type": "table",
      "columns": ["构建组合", "实际结果"],
      "rows": [
        ["默认", "94 通过"],
        ["无默认特性", "31 通过"],
        ["独立反代与透明入口", "90 通过"],
        ["默认 + WebSocket + SS", "100 通过"],
        ["仅隧道与透明入口", "55 通过，排除两项旧 HTTP 测试；未排除运行失败记录保留"]
      ]
    },
    {
      "type": "details",
      "summary": "精确验证命令与环境",
      "blocks": [
        {
          "type": "code",
          "lang": "text",
          "text": "rustc 1.100.0 (0ef1bc386 2026-11-09)\n项目声明：Rust 1.96 / edition 2024；没有升级工具链或依赖版本。\n\ncargo test --offline\ncargo test --offline --no-default-features\ncargo test --offline --no-default-features --features reverse-proxy,transparent-proxy\ncargo test --offline --features websocket,shadowsocks\ncargo test --offline --no-default-features --features transparent-proxy,vless-xhttp,websocket,shadowsocks -- --skip config::tests::single_domain_reverse_and_default_cm_ports --skip config::tests::remote_reverse_domain_contract_is_shared_by_typed_and_dynamic_modes\n\ncargo fmt --all -- --check  → exit 0\ngit diff --check           → exit 0"
        },
        {
          "type": "text",
          "md": "原始命令输出保存在本证明的同目录文本文件：default-final.txt、no-default-final.txt、reverse-final.txt、combined-final.txt、tunnels-filtered-final.txt。未过滤的隧道失败输出为 tunnels.txt。"
        },
        {
          "type": "code",
          "lang": "text",
          "text": "未过滤的隧道组合实际失败：\nconfig::tests::single_domain_reverse_and_default_cm_ports ... FAILED\nconfig::tests::remote_reverse_domain_contract_is_shared_by_typed_and_dynamic_modes ... FAILED\ncalled Result::unwrap() on an Err value: Config(\"HTTP requires the reverse-proxy feature\")\ntest result: FAILED. 33 passed; 2 failed\n\n这两项既有测试无条件对 HTTP 反代调用 configuration_policy().unwrap()；关闭 reverse-proxy 时已有 feature 校验会拒绝它。基线源码也有这一校验；没有将未过滤运行描述为通过，也没有改动这两项无关测试。"
        }
      ]
    },
    {
      "type": "text",
      "md": "证明二：实际执行链验证了请求内选路、同层耗尽、TLS 身份与池隔离，以及业务字节提交后的不重放。以下行来自本次测试输出。"
    },
    {
      "type": "code",
      "lang": "text",
      "text": "test http_proxy::tests::routed_h2_selects_per_request_exhausts_relays_and_isolates_upstream_pools ... ok\ntest http_proxy::tests::http_over_tunnel_negotiates_origin_tls_and_reuses_only_its_own_pool ... ok\ntest http_proxy::tests::http_tunnel_target_timeout_preserves_access_health_and_drains_abandoned_bridge ... ok\ntest http_proxy::tests::pooled_h2_capacity_wait_obeys_operation_deadline_without_submitting_again ... ok\ntest http_proxy::tests::business_websocket_rejection_is_not_replayed ... ok\ntest http_proxy::tests::truncated_response_is_a_body_error_and_is_never_replayed ... ok\ntest direct_http_preserves_mapped_identity_and_does_not_replay_business_response ... ok\ntest known_download_skips_incompatible_cdn_before_http_is_sent ... ok"
    },
    {
      "type": "text",
      "md": "证明三：独立探测与规划器的真实测试，覆盖部分超时汇总、并发、取消、固定优先级、稳定哈希、EWMA、恢复退避、过期证据及共享预算。"
    },
    {
      "type": "code",
      "lang": "text",
      "text": "test probe::tests::tcp_probe_only_opens_access_socket_and_closes_without_writing ... ok\ntest probe::tests::scheduler_summarizes_all_timeouts_and_bounds_concurrency_and_total_budget ... ok\ntest probe::tests::cancel_drains_running_and_queued_probes ... ok\ntest routing::tests::fixed_tiers_exhaust_same_tier_and_hash_is_stable ... ok\ntest routing::tests::failure_count_then_twenty_percent_window_then_capability_filter ... ok\ntest routing::tests::health_ewma_recovery_backoff_expiry_and_generation ... ok\ntest routing::tests::delayed_probe_publication_preserves_completion_time_and_ignores_older_evidence ... ok\ntest routing::tests::attempt_loop_shares_deadline_across_candidates_and_stops_after_commit ... ok\ntest direct_only_start_never_connects_origin_and_close_stops_pending_calls ... ok\ntest startup_collects_failed_and_good_candidates_and_rejects_all_failed ... ok\ntest canceled_start_drains_probes_and_never_accepts_business_before_publication ... ok"
    },
    {
      "type": "text",
      "md": "证明四：评审发现的重启校验缺口和半开桥接泄漏，先用相同回归复现失败，再修复通过。失败原始输出为 restart-before.txt、bridge-before.txt；通过输出见 default-final.txt 和 combined-final.txt。"
    },
    {
      "type": "code",
      "lang": "text",
      "text": "修复前：\ntest restart_rejects_invalid_tunnel_encryption_without_closing_old ... FAILED\nassertion failed: mode.restart(next, Default::default()).await.is_err()\ntest outbound::tests::dropping_bridge_connection_drains_half_open_upstream_before_sdk_close ... FAILED\nabandoned connection retained a bridge task\n\n修复后：\ntest restart_rejects_invalid_tunnel_encryption_without_closing_old ... ok\ntest outbound::tests::dropping_bridge_connection_drains_half_open_upstream_before_sdk_close ... ok\ntest restart_validates_first_and_keeps_old_handle_when_close_fails ... ok\ntest restart_replaces_inner_and_old_clones_remain_closed_on_success_and_failure ... ok"
    },
    {
      "type": "details",
      "summary": "改动范围、Rust 配置与绑定注意事项",
      "blocks": [
        {
          "type": "list",
          "items": [
            "共 19 个文件：仅 src、非绑定 tests、Cargo.toml 和根 README 的 Rust 设计说明。完整工作树差异为 changes.txt，包括四个未跟踪的新文件。",
            "新增内部模块 probe、routing、outbound；移除旧的 Steam 业务启动验证路径。A/B/C/D 共用现有 HTTP 处理，不复制 HTTP 栈。",
            "Rust 新配置：Routes { payload: Payload, reverse: Vec<modes::RemoteReverse>, direct: bool, tunnel: Vec<ForwardConfig> }，可直接传给 Profile::new，或转换为 ModeConfig。",
            "新增 Mode::restart(&mut self, next_config, cancel)。旧克隆保留旧 Inner，调用方重取新克隆。",
            "HTTP payload 需要 CA；TCP payload 不需要。EdgeOneWebSocket 按 TCP 能力过滤。已知下载在发送前过滤不兼容 CDN。",
            "ModeConfig 新增 Routes 分支，穷举匹配它的 Rust 使用方需要适配；Kind 保持原枚举，Routes 当前报告 remote-reverse，不能据此推导 payload 或 CA。",
            "未改 bindings、build-bindings.py 或 deploy。C 和其他语言包装层尚未新增候选集合构造器及 restart 入口，需对应任务适配。"
          ]
        },
        {
          "type": "code",
          "lang": "json",
          "text": "{\n  \"profile_id\": \"steam\",\n  \"mode\": {\n    \"kind\": \"routes\",\n    \"payload\": \"http\",\n    \"reverse\": [\n      {\"backend\": \"relay\", \"server_name\": \"relay.example.net\"}\n    ],\n    \"direct\": true,\n    \"tunnel\": []\n  }\n}"
        },
        {
          "type": "text",
          "md": "旧三种 kind 和历史 serde 输入继续兼容。HTTP C/D 为满足当前 Pingora 的真实描述符池校验，在首次业务时建立实例私有的回环 socket 桥接；这增加一对本机 socket 和一次转发，需要环境允许回环绑定。TLS 身份仍是实际映射域名。"
        }
      ]
    },
    {
      "type": "details",
      "summary": "一次独立评审及处理结果",
      "blocks": [
        {
          "type": "text",
          "md": "指定 Codex reviewer 以交互式只读子进程完成一轮，发现一个 blocker、四个 major。blocker 已复现并修复；另外补齐完整获取连接的 deadline 守卫、桥接生命周期和隧道内目标超时归因。完整处理记录为 review.txt。"
        },
        {
          "type": "text",
          "md": "对“必须在运行中自动检测网络变化”这一条未采纳：简报明确允许无既有入口时采用合理内部边界。当前边界为实例重建/restart，旧 registry 的迟到结果不能写入新实例；没有自动 OS 网络检测。宿主需在切网后 restart。评审提出的 H2 无限等待在本地零容量场景未复现，已加守卫并保留容量、预算和不提交第二次请求的检查。"
        },
        {
          "type": "callout",
          "tone": "warn",
          "title": "评审与提交状态",
          "md": "一轮评审结束后的修复已重新构建和测试，没有再启动第二轮。尚未获提交授权，所以未伪造 commit 评审记录，也未运行会要求提交的 Ready。"
        }
      ]
    },
    {"type": "heading", "level": 2, "text": "Not proven"},
    {
      "type": "list",
      "items": [
        "真实 Steam、CDN、生产 Relay、SS/VLESS 节点端到端可达性与性能；没有访问这些服务。",
        "物理网络切换的自动检测与运行中 generation 自动推进；当前要求宿主 restart。没有增加外部网络控制 API。",
        "Rust 1.96 的精确工具链兼容性及其他平台；本机实际验证工具链为已有的 1.100.0。",
        "其他语言绑定的编译、候选集合和 restart 接口；本任务没有修改或测试绑定。",
        "大规模流量下回环桥接的性能与资源上限；验证覆盖本地功能与取消回收，不代表压测。",
        "未过滤的纯隧道全套测试完全通过；两项旧 HTTP 默认特性假设测试仍失败，完整输出已保留。",
        "评审后修复的第二次独立复审；设置最多一轮，本次没有追加。",
        "提交、推送、PR、合并、部署与正式 Ready；均未执行，等待用户授权。"
      ]
    }
  ]
};
