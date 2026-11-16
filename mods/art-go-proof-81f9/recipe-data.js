// Written by herdr-artifact from recipe.json.
export default {
  "recipe": 1,
  "blocks": [
    {
      "type": "text",
      "md": "同一实例遇到网络变化后，会停止旧检查，清掉旧网络证据，再检查新候选。旧连接继续，新操作使用新一代出口；Go 下载资格和近期探测统计同时对齐。"
    },
    {
      "type": "callout",
      "tone": "warn",
      "title": "实现与运行验收分开",
      "md": "本次只有源码、测试源码、静态编译和独立评审证据。遵守 dev 不回归，没有运行 Rust/Go 测试、业务请求或设备验收。"
    },
    {
      "type": "stats",
      "items": [
        {
          "label": "目标分支",
          "value": "dev"
        },
        {
          "label": "静态检查",
          "value": "5/5"
        },
        {
          "label": "运行测试",
          "value": "未执行"
        }
      ]
    },
    {
      "type": "heading",
      "text": "真实接线与代际边界",
      "level": 2
    },
    {
      "type": "text",
      "md": "**Rust**：NativePlane.start → prepare_routes → 本机网络观察 → watch 合并事件 → maintain_routes 失效旧获取、取消并等待旧探测 → build_routes 新 generation → Registry.current 发布 → 重新检查接入点和 C。\n\nTCP/HTTP 获取绑定当代快照；旧回调无资格写入新健康。HTTP 池和 DNS 身份包含当代，旧活动流持有资源直到结束。每轮维护都回收空闲旧代，Close 取消并等待观察、探测与清理。"
    },
    {
      "type": "text",
      "md": "**Go**：Start → watchNetwork → 单元素变化队列 → 取消并等待旧探测 → resetNetwork → 新 route/access/tunnel/直连历史 → pool.advance → 重新取得接入资格。\n\nHTTP 写入前的 commitRequest 与网络失效在短锁内排序。H2 写头准入队列可取消，开始可能写入后保留该请求；WroteHeaders 只释放准入门。旧 H2 活动请求通过持有计数保留，池不调用会等待上传写锁的 State。Close 等待观察与出口收敛。"
    },
    {
      "type": "heading",
      "text": "支持范围和保留条件",
      "level": 2
    },
    {
      "type": "list",
      "items": [
        "默认源读取 Linux/macOS 的本机路由、接口或地址快照，不连接探测目标；宿主可用现有 dialer 边界交付稳定网络身份。",
        "其他平台没有默认源。同网关同地址切换、所有 VPN/DNS 配置及短于轮询周期的变化不保证检测。",
        "凭据/证书隔离和未过期目标冷却跨网络保留；TCP 成功不会洗掉它们。",
        "原公开配置、生命周期方法、wire/ABI、固定层级、共享 deadline 和提交后不重放保持。",
        "旧 Pingora 池 key 不供新操作使用，旧 idle socket 依原超时或实例 Close 回收；不声称所有旧 socket 在事件瞬间关闭。"
      ]
    },
    {
      "type": "heading",
      "text": "Rust 与 Go 能力核对",
      "level": 2
    },
    {
      "type": "list",
      "items": [
        "**下载过滤**：Worker / EdgeOne 禁止；Origin / Relay / C / D 保留载荷资格。层级不变；Go 无 EdgeOneWebSocket 反代配置。",
        "**近期探测**：当前 endpoint / generation，60 秒，最多 256 个完成/成功样本；取消单列。不等于 RTT、丢包率或业务成功率。",
        "**诊断消费**：真实 probe 记录与 EWMA；业务反馈不进入 probe 比例。窗口仍在内部，未有公开成功率导出。",
        "**旧流与新池**：旧流保留，新获取隔离；迟到结果不污染新代。全部并发与真实网络行为未运行。"
      ]
    },
    {
      "type": "heading",
      "text": "最终提交与 PR",
      "level": 2
    },
    {
      "type": "text",
      "md": "最终候选 `67145a825b263e47a2953c2e94d7fb65bed62fb2`。\n\nPR #8，状态 OPEN，`task/8-go` → `dev`。没有合并、Accept、main 推送、tag 或部署。"
    },
    {
      "type": "code",
      "lang": "text",
      "text": "{\n  \"baseRefName\": \"dev\",\n  \"headRefName\": \"task/8-go\",\n  \"headRefOid\": \"67145a825b263e47a2953c2e94d7fb65bed62fb2\",\n  \"number\": 8,\n  \"state\": \"OPEN\",\n  \"statusCheckRollup\": [],\n  \"url\": \"https://github.com/gamesir123/steam-proxy-sdk/pull/8\"\n}"
    },
    {
      "type": "heading",
      "text": "真实静态检查",
      "level": 2
    },
    {
      "type": "text",
      "md": "下表来自本次最终源码的实际命令退出状态。Go 使用 GOWORK=off、CGO_ENABLED=0、GOPROXY=off、GOSUMDB=off；go test -c 仅产生 binary，没有执行 binary/init。"
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
          "仅编译"
        ],
        [
          "format",
          "0",
          "静态检查"
        ],
        [
          "go-compile",
          "0",
          "仅编译"
        ],
        [
          "go-format",
          "0",
          "静态检查"
        ],
        [
          "diff-check",
          "0",
          "静态检查"
        ]
      ]
    },
    {
      "type": "details",
      "summary": "展开原始检查输出和源码哈希",
      "blocks": [
        {
          "type": "text",
          "md": "cargo check 的完整实际输出；保留编译器警告。"
        },
        {
          "type": "code",
          "lang": "text",
          "text": "warning: method `record` is never used\n  --> src/health/state.rs:82:19\n   |\n30 | impl Health {\n   | ----------- method in this implementation\n...\n82 |     pub(crate) fn record(&mut self, result: &Result<Duration>, startup: bool, generation: u64) {\n   |                   ^^^^^^\n   |\n   = note: `#[warn(dead_code)]` (part of `#[warn(unused)]`) on by default\n\nwarning: method `matches` is never used\n   --> src/inspection.rs:135:19\n    |\n134 | impl ClientIpRule {\n    | ----------------- method in this implementation\n135 |     pub(crate) fn matches(&self, host: &str, path: &str) -> bool {\n    |                   ^^^^^^^\n\nwarning: associated function `new` is never used\n  --> src/outbound/registry.rs:27:19\n   |\n26 | impl Registry {\n   | ------------- associated function in this implementation\n27 |     pub(crate) fn new(routes: Vec<Route>, generation: u64) -> Arc<Self> {\n   |                   ^^^\n\nwarning: method `child` is never used\n  --> src/managed_stream.rs:38:12\n   |\n36 | impl Connections {\n   | ---------------- method in this implementation\n37 |     #[cfg(feature = \"reverse-proxy\")]\n38 |     pub fn child(self: &Arc<Self>) -> crate::Result<Arc<Self>> {\n   |            ^^^^^\n\nwarning: fields `cipher` and `password` are never read\n  --> src/tunnel_url.rs:16:16\n   |\n12 | pub struct ShadowsocksUrl {\n   |            -------------- fields in this struct\n...\n16 |     pub(crate) cipher: String,\n   |                ^^^^^^\n17 |     pub(crate) password: Zeroizing<String>,\n   |                ^^^^^^^^\n   |\n   = note: `ShadowsocksUrl` has a derived impl for the trait `Clone`, but this is intentionally ignored during dead code analysis\n\nwarning: field `path` is never read\n  --> src/tunnel_url.rs:25:16\n   |\n21 | pub struct WebSocketUrl {\n   |            ------------ field in this struct\n...\n25 |     pub(crate) path: String,\n   |                ^^^^\n   |\n   = note: `WebSocketUrl` has a derived impl for the trait `Clone`, but this is intentionally ignored during dead code analysis\n\nwarning: unused imports: `DiagnosticRecorder`, `Kind`, and `ObservationContext`\n --> src/inspection_tests.rs:2:13\n  |\n2 | use crate::{DiagnosticRecorder, Kind, ObservationContext};\n  |             ^^^^^^^^^^^^^^^^^^  ^^^^  ^^^^^^^^^^^^^^^^^^\n  |\n  = note: `#[warn(unused_imports)]` (part of `#[warn(unused)]`) on by default\n\nwarning: unused import: `bytes::Bytes`\n --> src/inspection_tests.rs:3:5\n  |\n3 | use bytes::Bytes;\n  |     ^^^^^^^^^^^^\n\nwarning: unused import: `sync::Arc`\n --> src/inspection_tests.rs:4:34\n  |\n4 | use std::{collections::BTreeMap, sync::Arc};\n  |                                  ^^^^^^^^^\n\nwarning: variants `CacheSlow`, `CacheSized`, `CacheVary`, and `CacheRange` are never constructed\n   --> src/http_proxy_tests.rs:163:5\n    |\n159 | enum ResponseMode {\n    |      ------------ variants in this enum\n...\n163 |     CacheSlow,\n    |     ^^^^^^^^^\n...\n171 |     CacheSized,\n    |     ^^^^^^^^^^\n...\n175 |     CacheVary,\n    |     ^^^^^^^^^\n176 |     CacheRange,\n    |     ^^^^^^^^^^\n    |\n    = note: `ResponseMode` has a derived impl for the trait `Clone`, but this is intentionally ignored during dead code analysis\n    = note: `#[warn(dead_code)]` (part of `#[warn(unused)]`) on by default\n\nwarning: field `cipher` is never read\n  --> src/tunnel_url.rs:16:16\n   |\n12 | pub struct ShadowsocksUrl {\n   |            -------------- field in this struct\n...\n16 |     pub(crate) cipher: String,\n   |                ^^^^^^\n   |\n   = note: `ShadowsocksUrl` has a derived impl for the trait `Clone`, but this is intentionally ignored during dead code analysis\n\nwarning: `steam-proxy` (lib) generated 6 warnings\nwarning: `steam-proxy` (lib test) generated 7 warnings (2 duplicates) (run `cargo fix --lib -p steam-proxy --tests` to apply 3 suggestions)\n    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.23s\n"
        },
        {
          "type": "code",
          "lang": "json",
          "text": "{\n  \"candidate\": \"67145a825b263e47a2953c2e94d7fb65bed62fb2\",\n  \"base\": \"24707aed99ac5fc14cd0e8558c73602dc9516400\",\n  \"checks\": [\n    {\n      \"name\": \"cargo-check\",\n      \"command\": [\n        \"cargo\",\n        \"check\",\n        \"--offline\",\n        \"--locked\",\n        \"--tests\"\n      ],\n      \"exit_code\": 0,\n      \"output_empty\": false,\n      \"passed\": true,\n      \"elapsed_seconds\": 0.26\n    },\n    {\n      \"name\": \"format\",\n      \"command\": [\n        \"cargo\",\n        \"fmt\",\n        \"--all\",\n        \"--\",\n        \"--check\"\n      ],\n      \"exit_code\": 0,\n      \"output_empty\": true,\n      \"passed\": true,\n      \"elapsed_seconds\": 0.2\n    },\n    {\n      \"name\": \"go-compile\",\n      \"command\": [\n        \"go\",\n        \"test\",\n        \"-c\",\n        \"-o\",\n        \"/private/tmp/sps8-go.test\",\n        \".\"\n      ],\n      \"exit_code\": 0,\n      \"output_empty\": true,\n      \"passed\": true,\n      \"elapsed_seconds\": 0.84\n    },\n    {\n      \"name\": \"go-format\",\n      \"command\": [\n        \"gofmt\",\n        \"-l\",\n        \"__HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-8-go/bindings/go/http.go\",\n        \"__HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-8-go/bindings/go/mode.go\",\n        \"__HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-8-go/bindings/go/network_change.go\",\n        \"__HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-8-go/bindings/go/network_change_test.go\",\n        \"__HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-8-go/bindings/go/pool.go\",\n        \"__HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-8-go/bindings/go/pool_concurrency_test.go\",\n        \"__HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-8-go/bindings/go/pool_test.go\",\n        \"__HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-8-go/bindings/go/probe.go\",\n        \"__HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-8-go/bindings/go/routing.go\",\n        \"__HERDR_SYNC_HOME__/.local/share/shepherdr/worktrees/steam-proxy-sdk/task-8-go/bindings/go/routing_test.go\"\n      ],\n      \"exit_code\": 0,\n      \"output_empty\": true,\n      \"passed\": true,\n      \"elapsed_seconds\": 0.01\n    },\n    {\n      \"name\": \"diff-check\",\n      \"command\": [\n        \"git\",\n        \"diff\",\n        \"--check\",\n        \"dev...HEAD\"\n      ],\n      \"exit_code\": 0,\n      \"output_empty\": true,\n      \"passed\": true,\n      \"elapsed_seconds\": 0.01\n    }\n  ],\n  \"tests_executed\": false,\n  \"source_sha256\": {\n    \"README.md\": \"e7be40c3c96bbcb2d4588354ee558c8c861533301da1daae5a308d01f528dad7\",\n    \"bindings/go/README.md\": \"11555f886122062290347f891dad37df6b176b7f18059a64f3ffaeda6b24802c\",\n    \"bindings/go/http.go\": \"13e3e245ffd58057762f20d63b8c32a269226feb763ed6bb41cbea80ae884433\",\n    \"bindings/go/mode.go\": \"47c6814e0cea67d3852bb23f5335404ecbbeebcf683af70d3e8b1b2d3f3d7489\",\n    \"bindings/go/network_change.go\": \"6b565210df74c4a5760b7e11821f8efd307fb01aafe8469821d1b6e0643f2889\",\n    \"bindings/go/network_change_test.go\": \"237decc41a3d8b2cc53d10a1dbf9d3355d9b4b5afbb33f484a44cbbed86f8fb5\",\n    \"bindings/go/pool.go\": \"7616dccefcfc726891702f3985baa291e47a31c14551c147414f3efe0632d8db\",\n    \"bindings/go/pool_concurrency_test.go\": \"67ee2cbce4f86668d3e39d510c242fbc11c9fb10fb9dab93c56a3143b94159d0\",\n    \"bindings/go/pool_test.go\": \"0f176846bb70bd2f1ef6b81dfe1aade3c83ca7acd1e1610456f20148e61592ec\",\n    \"bindings/go/probe.go\": \"bf315c62d402600011b6921a375a5f70e4c525366a193a50c37802add3247cb6\",\n    \"bindings/go/routing.go\": \"9c3fe6607f64f05474d8092b86474d6a4e37291de7a4dc3eaf487ee28a06ed4e\",\n    \"bindings/go/routing_test.go\": \"6c3ce94b6972f344c07fbe91b9523ebc38592b55c5738cfd84e80ec506780ce4\",\n    \"src/backend.rs\": \"e2e03d70100731113f6aee866258088eb9c7abdf5c833504eb02fc907ccadcfd\",\n    \"src/dialer.rs\": \"f3c00feba435c9be398e2caefee3bbe27b2490ea40e737e970fb3406a5a205ca\",\n    \"src/health/state.rs\": \"d8f536841b5e59339c9e7b77f92e910cdb305987c5eb73ed19dba4b88f78f5cf\",\n    \"src/http_proxy.rs\": \"83bbb99d2db310643865b721af2446bf9b227702844245423b49a1d601c23b3f\",\n    \"src/http_proxy_tests.rs\": \"c55c9104e8b3d15a0777118129c88787f0e36c8ee4d1374b8b9617d2858cad54\",\n    \"src/lib.rs\": \"6c4352b9b3f718819cd287c8340e475bb0e7910abdd5313912f688c7d830d336\",\n    \"src/native_plane.rs\": \"27fc88c4c65b94fa6872e7a6cf03b0fa188b97f39cf91834aecff4285c3826bc\",\n    \"src/network_change.rs\": \"6ff1dc867a376b822273f8896b0dc420c1785240c316b4b7ea55bd14240699e4\",\n    \"src/outbound/direct.rs\": \"23da0011cc94494ef24ebddd571cf931d94568f80bccb32dec7f8d395d136bda\",\n    \"src/outbound/registry.rs\": \"b2672c9cbf1a8e6a02b2cbc039e2c5894495a29f7eb8ca724bb69c5ac38bdac7\",\n    \"src/outbound/stream.rs\": \"f6662e7cd16d20068efacce5e32540165bc00e4efec8a4106efe1edb886bc784\",\n    \"src/probe/mod.rs\": \"759632d78c10f4b0bd401c95bc7da30a5c91a13becd1d9b388ff306064fbb075\",\n    \"src/probe/scheduler.rs\": \"c4ebfd3e9e0561ef04aa165adec35834729c019f49069b01b8e61af6f26e5549\"\n  }\n}"
        },
        {
          "type": "text",
          "md": "Go 编译、Rust/Go 格式与 diff 检查均实际退出 0 且无输出，详情见上面的 summary。"
        }
      ]
    },
    {
      "type": "heading",
      "text": "基线与候选源码核对",
      "level": 2
    },
    {
      "type": "text",
      "md": "同一静态结构规则在基线记录缺失、候选记录存在。此证据只证明源码接线，不能冒充 bug 的行为复现。运行复现留待 main 授权。"
    },
    {
      "type": "details",
      "summary": "展开实际 source audit 输出",
      "blocks": [
        {
          "type": "code",
          "lang": "json",
          "text": "{\n  \"kind\": \"source structure only; no behavior or test execution\",\n  \"base\": \"24707ae\",\n  \"before\": {\n    \"Rust assembled observer and generation maintenance\": false,\n    \"Rust snapshot acquisition and old feedback guard\": false,\n    \"Rust HTTP pool and DNS snapshot identity\": false,\n    \"Go assembled observer and generation reset\": false,\n    \"Go old pools and late returns excluded\": false,\n    \"Go download restrictions use backend capability\": false,\n    \"Go bounded recent probe and separate cancellation storage\": false\n  },\n  \"after\": {\n    \"Rust assembled observer and generation maintenance\": true,\n    \"Rust snapshot acquisition and old feedback guard\": true,\n    \"Rust HTTP pool and DNS snapshot identity\": true,\n    \"Go assembled observer and generation reset\": true,\n    \"Go old pools and late returns excluded\": true,\n    \"Go download restrictions use backend capability\": true,\n    \"Go bounded recent probe and separate cancellation storage\": true\n  }\n}\n"
        }
      ]
    },
    {
      "type": "heading",
      "text": "唯一正式独立评审",
      "level": 2
    },
    {
      "type": "text",
      "md": "指定 codex / auto/gpt-6-astra / medium，独立只读，只有一轮。初次候选发现两个 blocker 和一个 major；同轮修正核对又发现 H2 DATA 写锁阻塞问题。各项均已修正，由同一 reviewer 核对真实最终 SHA。详细处置以以下原始报告为准。"
    },
    {
      "type": "details",
      "summary": "展开 reviewer 报告与同轮处置",
      "blocks": [
        {
          "type": "code",
          "lang": "text",
          "text": "• Same formal review round 1 of 1, verified against final SHA 67145a825b263e47a2953c2e94d7fb65bed62fb2 and dev 24707aed99ac5fc14cd0e8558c73602dc9516400.\n\n  No blocker or major findings remain in the reviewed source. All previously reported code findings are resolved at this SHA. One minor proof-artifact issue remains.\n\n  • Rust startup deadline blocker — resolved. The shared absolute deadline reaches the probe scheduler, and budget exhaustion aggregates completed qualifications instead of unconditionally returning\n    cancellation. The C-plus-sixteen-slow-remotes test source remains present.\n\n  • Go HTTP commitment race — resolved. commitRequest orders commitment against generation invalidation under the same short health lock and disarms network cancellation before possible transmission.\n\n  • Rust retired-generation accumulation — resolved. Inactive generations are reaped at the beginning of every maintenance iteration, including successive network-change iterations.\n\n  • Go H2 write-mutex blocker — resolved. pool.go:38 (bindings/go/pool.go:38) uses cancelable admission and CanTakeNewRequest; production pool/admission code contains no ClientConn.State() calls. The\n    pinned CanTakeNewRequest implementation uses the state mutex rather than the write mutex. Pool acquisition increments SDK-owned request counts before returning a connection, and initial H2\n    connections acquire ownership before pool admission. http.go:115 (bindings/go/http.go:115) releases ownership exactly once through error cleanup or response-body closure. Pool retirement and\n    expiry use those counts. The new held-DATA-write test source requires cancellation, requalification, and a successful new-generation request before releasing the old write.\n\n  Minor — the supplied “full final diff” artifact contains only a diffstat.\n  Location: sps8-review-final.diff:1 (/private/tmp/sps8-review-final.diff:1). Its contents match git diff --stat dev...HEAD, not the full patch. Likewise, sps8-review-data-fix.diff contains the\n  incremental diffstat. Replace these with complete patch output, or label them as statistics and supply the actual patches. This did not block verification: I inspected the actual incremental Git\n  patch and carried forward the complete source review from this same round.\n\n  All 25 refreshed source hashes match the checkout. Final HEAD remains the specified SHA, and the working tree is clean. Independent cargo fmt --all -- --check, changed-file gofmt -l, and git diff\n  --check dev...HEAD passed. I inspected the refreshed summary and all named logs; they report successful compile-only checks for this candidate.\n\n  Not run in my sandbox: Rust/Go compilation, which requires writable build outputs and caches. No tests, application binaries/init, race checks, feature matrices, dependency downloads/upgrades,\n  traffic, or other agents were run.\n\n  These dispositions establish source-level correction only. Runtime concurrency, platform network observation, committed-flow continuity, and shutdown behavior remain unexecuted acceptance work as\n  recorded in the ledger.\n\nWorker evidence-only disposition after report: the minor diffstat issue was corrected using uncondensed Git output. No source or commit changed after review.\n/private/tmp/sps8-review-final.diff: complete patch independently matches Git; sha256=cfc434f0b05ee0e0f40008278ecdef302ffde9660304de4f3e0825b5ae03ec2a\n/private/tmp/sps8-review-data-fix.diff: complete patch independently matches Git; sha256=6db2bcb4dcf0fe0b5eef015ad4079d6573f8f290e1cc00de47ff1b88d4fe7b98\n"
        }
      ]
    },
    {
      "type": "heading",
      "text": "逐章节与全部验收场景",
      "level": 2
    },
    {
      "type": "text",
      "md": "台账覆盖原设计各章、第十二节全部场景、Rust/Go 映射、测试源码索引、未满足的实现要求和 main 待验收项。A 只表示源码或静态事实，不表示业务通过。"
    },
    {
      "type": "details",
      "summary": "展开完整验收台账",
      "blocks": [
        {
          "type": "text",
          "md": "# SPS-8 需求与验收台账\n\n核对日期：2026-11-16。实际基线 dev/origin/dev/task/8-go 为 24707ae，包含 SPS-6 的 d8ca233 和 SPS-7 的 24707ae。原设计全文通过 Obsidian CLI 读取，与 20261115 快照一致。已读 SPS-6/SPS-7 最终 ledger、review 与 proof 记录。前序候选 SHA 与 squash 合入 SHA 区分保留。\n\n范围：同实例网络变化的 Rust/独立 Go 交付、Go 下载能力与近期探测统计；保留前序 Planner/出口组合。公开配置、C/TS/Swift/Kotlin wire/ABI、依赖、离线工具、部署均未改。没有创建其他开发任务或开发代理。\n\n状态：A 仅指源码事实/静态证据；B 表示有实现但运行未验收；C 为明确实现缺口；D 为尚待核实。以下新增测试都只是源码；本轮不运行 Rust/Go 测试、race、feature 回归矩阵、设备、真实节点或 Steam 请求。\n\n最终交付：67145a825b263e47a2953c2e94d7fb65bed62fb2；PR #8，task/8-go → dev，未合并。最终 SHA 的 cargo check --offline --locked --tests、cargo fmt --all -- --check、Go go test -c、gofmt 和 git diff --check 均真实通过。检查输出、源码哈希见 checks-summary.json 及日志；未执行任何测试 binary/init。\n\n唯一正式评审：指定 codex / auto/gpt-6-astra / medium 以只读模式在同一轮核对最终 SHA，无 blocker/major。初次启动预算、HTTP 提交边界和连续事件回收问题，以及同轮后续 H2 DATA 写锁问题均在源码中修正。minor 为临时 diff 文件曾只有 diffstat：已补完整 patch，并独立逐字节与 Git 输出比对；未改变评审后的源码或提交。保留 reviewer 原始结论及工作者证据处置于 review.txt。评审不构成运行验收。\n\n## 网络事件到资源收敛的实际链路\n\n- Rust：NativePlane::start → prepare → choose_backend → prepare_routes。启动前取得网络身份，tasks.spawn(network_change::watch) 每秒比较稳定快照，watch::Sender 合并重复/连续快照。maintain_routes 同时等变更、启动 deadline、取消及 check_routes；事件先 Registry::invalidate，取消并等待旧 ProbeScheduler 的在途和排队任务，再 build_routes 新代。新 Registry 继承凭据/证书隔离及未过期目标冷却，重建 DirectOutbound 和 TunnelOutbound，发布 root.current 的新快照；同一 SDK session 的哈希种子保留。\n- Rust 业务：Backend::connect_observed / HTTP::upstream_peer 取得当代 Registry。未提交获取由 acquisition token 取消；HTTP commit 在短健康读锁内与 invalidate 排序。RequestContext 绑定当代反馈，DNS 缓存和 Pingora group_key 含当代身份；GenerationStream/HTTP token 保持旧业务出口存活。旧代 active 为空后关闭能力、桥接及直连历史；根 HTTP 池的旧 key 不供新操作使用，空闲连接沿原 30 秒超时或实例关闭回收。此处不声称所有旧 Pingora idle socket 都在事件瞬间关闭。\n- Go：Start 在共享启动预算内读取身份并启动 watchNetwork，单元素 changes channel 只保存最新事件。Start/probeLoop 收到事件，取消并等待旧探测，再 resetNetwork，新建候选、accessHealth、直连历史和隧道。blocked 和未过期 cooldowns 保留，session seed 不变，networkCtx 只限制获取/未提交队列。\n- Go 业务：选中 route 的 immutable generation 决定拨号、反馈及 poolKey；context.AfterFunc 取消未完成 dial/TLS/H2 preface。HTTP/2 有连接私有、可取消的写头准入门，使用非 StrictMaxConcurrentStreams 的 CanTakeNewRequest 读取容量，不调用会等待写锁的 State；取得资格后，HTTP/1 与 HTTP/2 都通过 commitRequest 在短健康锁内与网络 invalidate 排序并解除网络取消，再开始可能发送的写入。WroteHeaders 只释放写头门，不再作为提交边界。未提交的队列可取消，已提交的写头、响应和流保留。routeConnection 的 users 使旧隧道等待其活动连接结束。pool.advance 排除旧 key 和迟到归还；旧 H2 活动连接由 SDK 请求持有计数保留，在错误清理或响应体关闭后释放，等全部活动请求结束再回收。池推进/取用/过期都不调用 State，不等待旧 HEADERS/DATA/control 写入锁。\n- 关闭：Rust Session 取消、关 socket，等待 TaskTracker 内观察/维护/探测与代际清理；Go Close 取消、关资源/池，等待 work 后关闭当前/旧代出口。退休 Go tunnel 的关闭错误会保留重试并返回 Close，不把未完成清理误报成功。restart 仍先等旧实例 Close，再新建；不改变旧 clone/owner 契约。\n\n## 默认事件与宿主边界\n\n| 实现 | 默认入口 | 可替换边界 | 支持范围与限制 |\n| --- | --- | --- | --- |\n| Rust | network_change::revision：Linux /proc/net 路由、IPv6 地址、fib_trie、resolv.conf；macOS 本机 route/ifconfig | 既有 TcpDialer 默认方法 network_revision()，可覆盖返回稳定身份或 None | 仅 Linux/macOS 本机快照字段变化；macOS DNS 未完整接入；Windows/iOS/Android 等无默认源 |\n| Go | localNetworkRevision：Linux 接口/地址、路由与 resolv.conf；macOS 接口/地址与 route 默认网关 | 宿主 Dialer 可实现 NetworkObserver.NetworkRevision(ctx)；否则用本机源 | 同网关同地址的 Wi-Fi 切换、所有 VPN/DNS 变化、轮询之间的瞬变不保证检测；其他平台无默认源 |\n\n两者均每秒本机取样；读取失败保留上次可读身份，不把失败伪造成网络已变化。宿主源必须可取消且不主动连接 Steam/业务目标。没有新切线控制 API，不修改系统路由、代理、证书或外部探测服务。默认源的真实 OS 行为留待 main/设备验收。\n\n## Rust / Go 行为映射与真实局限\n\n| 契约 | Rust | Go | 判定 |\n| --- | --- | --- | --- |\n| generation 与迟到结果 | 新 Registry/Backend/DirectOutbound；旧快照失去资格与反馈写入资格 | route.generation、accessHealth.generation、新 route/access；所有业务反馈检查代际及取消 | A（源码）、B（运行） |\n| 探测范围/并发 | group_targets、ProbeScheduler、TcpProbe；3 并发/3 秒/15 秒 | probeRunner/ProbeLoop；相同接入共享 access，最多 3 在途 | A/B；跨 SDK 实例的进程级总限额未实现，既有语义是实例级 |\n| 60 秒统计 | Health.samples/cancellations；业务 Access 不再混入 probe 样本，最多 256；定时 prune | accessHealth.samples/cancellations；实际 probeResult.completed，最多 256；定时 prune | A/B；取消不计完成/成功分母；旧代状态丢弃 |\n| dial_elapsed | 成功 Probe 的总拨号耗时与 EWMA | 同上；业务成功不更新探测 EWMA | A/B；不是 RTT/丢包率，未造细分测量 |\n| 诊断消费 | 窗口仅在内部 Health；Observer 仍是实际阶段/业务事件 | 窗口仅在内部 accessHealth；Status 不导出窗口 | D：两者都没有近期成功比例的公开诊断消费链；不引入平台或评分算法 |\n| 归因保留 | isolated/targets 继承；TCP 成功不清业务隔离 | blocked/cooldowns 继承；旧代/取消不改新健康 | A/B |\n| 池与既有流 | snapshot group key/DNS 身份；旧活动 token 保留 | immutable route poolKey、retired H2、route users | A/B；完整并发运行、关闭和 XHTTP 长载流未运行 |\n\n## Backend 与下载/载荷资格\n\n| backend | 层级 | Rust | 独立 Go | 下载资格 |\n| --- | --- | --- | --- | --- |\n| Relay | A | HTTP 远端反代 | HTTP 远端反代 | 允许 |\n| CloudflareWorker | B | HTTP 反代 | HTTP 反代 | 禁止已识别下载 |\n| EdgeOne | B | HTTP 反代 | HTTP 反代 | 禁止已识别下载 |\n| EdgeOneOrigin | B | HTTP 反代，保留实际身份/头规则 | HTTP 反代，原 serverName/头规则保留 | 允许；Go 从按 B 全禁改为按 backend 能力 |\n| Direct | C | 原始 TCP/HTTP；只真实业务解析地址 | 同上 | 允许符合 payload 的业务 |\n| Tunnel | D | VLESS/XHTTP、WSS、SS 依编译能力；HTTP 内层 TLS/authority | 同上，依 Go 编译标签 | 允许符合 payload 的业务 |\n| EdgeOneWebSocket | backend 的 B | TCP 载荷，HTTP 配置归一化过滤 | 当前 Go 无该反代枚举/配置；WSS 隧道不等于该 backend | Go 未新增配置或冒充支持；Rust 按真实 TCP 能力 |\n\n## 全章节当前状态\n\n| 章节 | 当前实现/静态证据 | 测试源码与未运行项 |\n| --- | --- | --- |\n| §1 接口与宿主 | 原 Factory/生命周期/注入保留；增加兼容的 dialer 身份观察边界 | 原生命周期/连接入口测试保留；宿主设备仍 B/D |\n| §2 能力与固定层级 | 前序反代/隧道组合保留；Go 下载按 backend 修正，TCP 仍过滤 HTTP 反代 | TestDownloadEligibilityUsesBackendCapability；原排序/协议测试保留，运行 B |\n| §3 配置 | Rust/Go 配置、wire、ABI 未变；无切线 API | 原配置与绑定测试源码保留，运行 B |\n| §4 职责/组合 | native 组装事件；registry 管代际资源；health 归因；probe 独立；Planner 主体未改 | 前序策略/出口替换测试保留，运行 B |\n| §5 状态/锁 | 当代快照/immutable route；健康短锁；事件读取、协议准备与清理不持健康长锁 | 并发安全运行 B；既有 HTTP DNS cache 锁模式未重写 |\n| §6/6.1 独立 Probe | 仅接入点，保留 total dial 成本；旧探测取消后等待再重新调度 | 新网络启动在途用例；原 EOF/无业务写入测试，运行 B |\n| §6.2 调度/恢复 | 旧代在途/队列先收敛，新代首次有界资格检查，后续沿既有阈值/退避 | 原公平/超时/恢复测试及新增取消/重复事件源码，运行 B |\n| §6.3 指标 | 两者均有独立 60s completed/success 窗口及取消计数，最多256；同层评分规则不变 | Rust recent_probe_window_excludes_business_cancellation_and_old_generation、Go TestRecentProbeWindowCancellationAndBusinessSeparation，运行 B；公开诊断 D |\n| §7 Start | 身份读取与连续事件共享启动预算；未汇总不发布业务资格；C 无原站探测 | Rust/Go 网络变化中启动、原 startup_contract 测试，运行 B |\n| §8 健康/网络 | 原 C 网络整链缺口已补齐为 A（源码）/B（运行），不是靠 restart；隔离/冷却跨网络保留 | 见下新增源码；真实网络恢复与设备 D |\n| §9 Restart | 公共方法不变，Close 等待本实例新增观察/代际维护 | 原生命周期/restart 测试保留，设备交接 B/D |\n| §10 协议/池 | 复用前序 NativeStream/NativeHttp/Tunnel；每代重新组装，TLS/authority/ALPN/connector 隔离 | 新网络 HTTP 池测试；原 C/D TLS/池与替换隧道测试，运行 B |\n| §11 预算/提交 | 不跨候选重放；HTTP2 写头前队列可取消，已提交继续；原共享业务 deadline 保留 | 原 no-replay/预算测试、新旧 H2 流源码，运行 B |\n| §12 落点/验收 | routing/outbound/health/probe 原职责与接口保留；报告仅临时目录/proof | 全部场景逐项如下；无业务运行通过结论 |\n\n## 第 12 节全部场景台账\n\n1. Relay/CDN 同配：前序共享反代保持，A 优先 B。A 源码/B 运行；原固定层级测试。\n2. A1 失败先 A2：Planner 未改；原 fixed_tiers / Go fallback 测试。B。\n3. 40/45/10ms 稳定分配：session seed 跨网络保留，仅新测量重新比较；原选择测试。B。\n4. 慢 DNS/轮换 dial：实际 probe 总成本/计时保留；Go completed 单独记录，非 RTT。B，专门慢 DNS 组合运行待核实。\n5. 单次失败/连续阈值：原算法保留；样本统计不替代熔断。B。\n6. A 不可用逐级 B/C/D：固定层级不改。B。\n7. TCP 过滤 HTTP backend：保留；Go EdgeOneWebSocket 缺少原配置能力明确列出，未新增 wire。B/D。\n8. Start 部分超时：共享总预算，变更取消旧 probe 后收齐新代结果。新网络启动测试源码，B。\n9. 只 C 零原站探测：新增 Rust native_network_event_keeps_committed_stream_resets_history_and_stops_subscription；Go TestNetworkChangeDirectOnlyKeepsStreamAndClearsHistoryAndStopsObserver。B。\n10. 全部无资格：原 NoEndpoint/ErrNoAvailableRoute 保留；凭据隔离不能被网络刷新洗掉。B。\n11. 只探接入点：新增 Rust network_event_during_start_drains_old_probe_and_rechecks_only_access；Go TestNetworkChangeDuringStartDrainsOldProbeAndPreservesIsolation。B。\n12. 全业务出口拒绝仍 probe：SPS-7 的 startup_probe_works_with_every_http_and_stream_outlet_replaced_by_refusal 保留。A（源码）/B（运行）。\n13. TCP 成功不清凭据/429：新网络继承 isolation/cooldowns；原 HTTP429/凭据测试及新网络测试源码。B。\n14. 冷却/C 地址/网络变化：原网络实现 C 更新为 A（已接线源码）/B（未运行）；原站不主动探测，旧反馈不能覆盖新健康。\n15. 高优先级恢复、新旧流：层级算法保留；新增原始 TCP 和 H2 的网络代际流共存源码。B；完整 A 恢复时流共存仍 D。\n16. 用户选择 B1 restart：原类型/owner/Close-before-Start 保留。B。\n17. Closed 新 Mode：原生命周期逻辑保留。B。\n18. 旧连接结束不重放、新启动交接：restart 原行为保留，新增观察/代际任务随 Close 收敛。B；宿主交接未运行。\n19. 新 start失败/旧 Close未完：原失败状态/重试 Close 保留，退休 Go 出口关闭错误不丢弃。B。\n20. 可能发送后不重放：原边界保留；网络事件只取消未提交获取/排队。B；新增 TestNetworkChangePreservesCommittedHTTP2BodyAndSeparatesNewPool。\n21. Planner 纯内存输入：SPS-6 组合保持，未重写 Planner。A（源码）/B（运行）。\n22. 原配置/语言入口：Rust/Go 入口兼容；C/TS/Swift/Kotlin wire 未改。B；跨语言/设备 D。\n23. cancel/Close全收敛：观察、探测、排队、旧代出口/池都接入本实例任务/资源归属。新增实际 NativePlane Close 和 Go Close 源码，原关闭/取消测试保留。B，完整并发 race/长载流运行 D。\n\n## 本轮新增测试源码索引\n\n- Rust：native_network_event_keeps_committed_stream_resets_history_and_stops_subscription；network_event_during_start_drains_old_probe_and_rechecks_only_access；network_event_makes_subsequent_http_use_a_new_pool_and_ignores_old_feedback；recent_probe_window_excludes_business_cancellation_and_old_generation；startup_budget_settles_slow_remotes_and_keeps_local_direct_available；sustained_changes_reap_inactive_generations_without_waiting_for_probe_completion。\n- Go：TestNetworkChangeDirectOnlyKeepsStreamAndClearsHistoryAndStopsObserver；TestNetworkChangeDuringStartDrainsOldProbeAndPreservesIsolation；TestNetworkPoolRejectsLateReturnsAndNewOperations；TestNetworkChangePreservesCommittedHTTP2BodyAndSeparatesNewPool；TestRecentProbeWindowCancellationAndBusinessSeparation；TestDownloadEligibilityUsesBackendCapability；TestRequestCommitOrdersNetworkInvalidationWithoutHoldingLockDuringWrite；TestHTTP2HeaderQueueCancellationDoesNotEnterCommit；TestNetworkInvalidationDuringCommittedHTTP2HeaderWriteDoesNotCancelStream；TestHeldHTTP2DataWriteDoesNotBlockCanceledAdmissionOrNetworkRequalification（挂起真实 TLS DATA 写入；未提交准入取消、容量读取、新代探测和请求须在释放旧写入前完成）。\n- source audit 对同一源码契约比较基线/候选，只证明静态结构缺失→存在，不是 bug 的行为复现通过。行为复现/验证遵用户要求留 main。\n\n## 仍未满足/尚待核实与 main 运行验收\n\n- 明确实现覆盖限制：默认网络源只有 Linux/macOS 的所述快照字段；其他 OS 需宿主 Dialer 身份源，不声称所有平台自动订阅。\n- 明确能力差距：Go 未有 EdgeOneWebSocket 反代 backend；现有公开配置不包含它，本轮不扩配置。Rust 该 backend 是 TCP，不能当普通 HTTP；WSS tunnel 各自保持。\n- 明确未有公开消费：Rust/Go 的近期 probe 窗口都没有公开诊断导出/成功率展示；首字节、正文吞吐、缓存/复用的完整诊断消费链仍需进一步核实，不宣称监控完成。\n- 待核实：DirectOutbound 独立地址选择策略是否要求进一步抽离；当前 S 仍是 TcpDialer，地址算法固定，未扩大为 Planner/协议重写。\n- 待核实：全实例级与进程级“全局 3 并发”含义；当前每 SDK 实例 3，不承诺所有实例共用进程配额。\n- main 待授权：运行所有新旧 Rust/Go 测试、race、feature/平台/绑定矩阵；真实网卡/路由/VPN变化、Start/Close/Restart竞态、连续事件、XHTTP上传及已有 H2/TCP长流；真实节点/Steam/证书与吞吐。静态编译、源码台账和评审均不能代替运行。\n\n## Not proven\n\n- 本轮没有执行任何 Rust/Go 测试 binary 或 init，没有回归/race/feature矩阵，没有设备、真实节点或 Steam 请求。\n- 默认 OS 网络观察的运行效果、真实业务无损、池收敛/队列/后续 XHTTP carrier 的全部竞态均未运行验收。\n- 本文 A 不表示业务验收；B/D 留待 main 阶段授权。上述明确实现差距不能由静态检查或等待 main 测试自动销项。\n"
        }
      ]
    },
    {
      "type": "heading",
      "text": "Not proven",
      "level": 2
    },
    {
      "type": "list",
      "items": [
        "未运行 Rust/Go 测试或 init、回归、race、feature/平台/绑定矩阵。",
        "未运行真实网络切换、VPN、设备、节点、Steam、证书或吞吐验收。",
        "未证明全部启动/获取/探测/业务/关闭/重启竞态、长 H2/TCP 流与后续 XHTTP 上传在运行中正确。",
        "默认观察不是全平台全网络事件源；Go 未有 EdgeOneWebSocket 反代配置；近期窗口未公开导出。",
        "DirectOutbound 独立地址策略、进程级总探测配额和完整诊断消费链等设计范围仍待核实。详见台账。"
      ]
    }
  ]
};
