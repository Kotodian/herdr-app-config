// Written by herdr-artifact from recipe.json.
export default {
  "recipe": 1,
  "blocks": [
    {
      "type": "text",
      "md": "C、TypeScript、Swift、Kotlin 已增加多线路候选集合配置和所有者级重启入口。\n旧单出口配置保持兼容；切线结束旧连接，成功后重新取得连接句柄。\n本次目标为 dev：下方是实际静态检查证据，运行回归按用户要求留到 main。"
    },
    {
      "type": "stats",
      "items": [
        {
          "label": "静态检查组",
          "value": "8 / 8",
          "note": "实际命令均成功"
        },
        {
          "label": "运行回归",
          "value": "未运行",
          "note": "依用户要求留到 main"
        },
        {
          "label": "目标分支",
          "value": "dev",
          "note": "不推进 main / 发布"
        }
      ]
    },
    {
      "type": "table",
      "columns": [
        "客户端",
        "配置 / 切线"
      ],
      "rows": [
        [
          "C",
          "SpnRoutesConfig / spn_restart_client"
        ],
        [
          "TypeScript",
          "ProtocolConfig / ProtocolEngine.restart"
        ],
        [
          "Swift",
          "ProxyExit.routes / NativeEngine.restart"
        ],
        [
          "Kotlin",
          "Exit.Routes / NativeEngine.restart"
        ]
      ]
    },
    {
      "type": "text",
      "md": "检查时间：2026-11-16 01:15:16 -0500。候选提交：`43923784669b8ea9882138cc6a7d8cc74c284ded`。编译环境为本机 macOS；Swift 和 Kotlin/JNI 检查不代表设备运行。"
    },
    {
      "type": "text",
      "md": "Rust native and default test sources (compile only) — PASS。以下来自本轮真实命令输出，工具链路径缩写。"
    },
    {
      "type": "details",
      "summary": "展开真实命令与输出",
      "blocks": [
        {
          "type": "code",
          "lang": "text",
          "text": "$ cargo check --locked --offline --manifest-path bindings/c/Cargo.toml --tests\nexit: 0\nCompiling aws-lc-sys v0.45.0\n   Compiling ring v0.17.14\n   Compiling zstd-sys v2.1.2+zstd.1.5.7\n   Compiling zstd-safe v8.2.0\n    Checking zstd v0.14.3\n    Checking x509-parser v0.18.1\n    Checking pingora-header-serde v0.9.1\n    Checking rcgen v0.14.10\n   Compiling aws-lc-rs v1.18.1\n   Compiling rustls v0.23.40 (https://github.com/aimalygin/shaped-rustls?rev=3a131beaef0183b0cb61e5a9070a703b6be39ed3#3a131bea)\n    Checking rustls-webpki v0.103.16\n    Checking xray-proxy v0.9.0 (https://github.com/aimalygin/xray-rust?rev=0cabb69b85214b959033e74c542408585bbbe4e8#0cabb69b)\n    Checking xray-vless-encryption v0.9.0 (https://github.com/aimalygin/xray-rust?rev=0cabb69b85214b959033e74c542408585bbbe4e8#0cabb69b)\n    Checking tokio-rustls v0.26.6\n    Checking quinn-proto v0.11.16 (https://github.com/aimalygin/xray-rust?rev=0cabb69b85214b959033e74c542408585bbbe4e8#0cabb69b)\n    Checking pingora-rustls v0.9.1\n    Checking pingora-core v0.9.1\n    Checking quinn v0.11.9 (https://github.com/aimalygin/xray-rust?rev=0cabb69b85214b959033e74c542408585bbbe4e8#0cabb69b)\n    Checking h3-quinn v0.0.10 (https://github.com/aimalygin/xray-rust?rev=0cabb69b85214b959033e74c542408585bbbe4e8#0cabb69b)\n    Checking xray-transport v0.9.0 (https://github.com/aimalygin/xray-rust?rev=0cabb69b85214b959033e74c542408585bbbe4e8#0cabb69b)\n    Checking pingora-cache v0.9.1\n    Checking pingora-proxy v0.9.1\n    Checking steam-proxy v0.1.0 (<task>)\nwarning: method `matches` is never used\n   --> <task>/src/inspection.rs:135:19\n    |\n134 | impl ClientIpRule {\n    | ----------------- method in this implementation\n135 |     pub(crate) fn matches(&self, host: &str, path: &str) -> bool {\n    |                   ^^^^^^^\n    |\n    = note: `#[warn(dead_code)]` (part of `#[warn(unused)]`) on by default\n\nwarning: method `child` is never used\n  --> <task>/src/managed_stream.rs:38:12\n   |\n36 | impl Connections {\n   | ---------------- method in this implementation\n37 |     #[cfg(feature = \"reverse-proxy\")]\n38 |     pub fn child(self: &Arc<Self>) -> crate::Result<Arc<Self>> {\n   |            ^^^^^\n\nwarning: fields `cipher` and `password` are never read\n  --> <task>/src/tunnel_url.rs:16:16\n   |\n12 | pub struct ShadowsocksUrl {\n   |            -------------- fields in this struct\n...\n16 |     pub(crate) cipher: String,\n   |                ^^^^^^\n17 |     pub(crate) password: Zeroizing<String>,\n   |                ^^^^^^^^\n   |\n   = note: `ShadowsocksUrl` has a derived impl for the trait `Clone`, but this is intentionally ignored during dead code analysis\n\nwarning: `steam-proxy` (lib) generated 3 warnings\n    Checking steam-proxy-engine v0.1.0 (<task>/bindings/c)\nwarning: method `fail` is never used\n  --> src/memory.rs:56:12\n   |\n40 | impl Link {\n   | --------- method in this implementation\n...\n56 |     pub fn fail(&self) {\n   |            ^^^^\n   |\n   = note: `#[warn(dead_code)]` (part of `#[warn(unused)]`) on by default\n\nwarning: `steam-proxy-engine` (lib test) generated 1 warning\n    Finished `dev` profile [unoptimized] target(s) in 20.32s"
        }
      ]
    },
    {
      "type": "text",
      "md": "C wrapper and frozen ABI assertions — PASS。以下来自本轮真实命令输出，工具链路径缩写。"
    },
    {
      "type": "details",
      "summary": "展开真实命令与输出",
      "blocks": [
        {
          "type": "code",
          "lang": "text",
          "text": "$ clang -std=c11 -Wall -Wextra -Werror -fsyntax-only -I bindings/c/include bindings/c/src/engine.c tests/bindings/typed-abi.c\nexit: 0\n(no diagnostic output)"
        }
      ]
    },
    {
      "type": "text",
      "md": "Node native addon — PASS。以下来自本轮真实命令输出，工具链路径缩写。"
    },
    {
      "type": "details",
      "summary": "展开真实命令与输出",
      "blocks": [
        {
          "type": "code",
          "lang": "text",
          "text": "$ c++ -std=c++17 -Wall -Wextra -Werror -fsyntax-only -I /opt/homebrew/include/node -I /opt/homebrew/include -I bindings/c/include bindings/ts/src/addon.cc\nexit: 0\n(no diagnostic output)"
        }
      ]
    },
    {
      "type": "text",
      "md": "Android JNI with installed NDK — PASS。以下来自本轮真实命令输出，工具链路径缩写。"
    },
    {
      "type": "details",
      "summary": "展开真实命令与输出",
      "blocks": [
        {
          "type": "code",
          "lang": "text",
          "text": "$ <installed-NDK>/aarch64-linux-android26-clang -std=c11 -Wall -Wextra -Werror -fsyntax-only -I bindings/c/include bindings/kotlin/jni/engine_jni.c bindings/c/src/engine.c\nexit: 0\n(no diagnostic output)"
        }
      ]
    },
    {
      "type": "text",
      "md": "Swift wrapper and boundary test sources (compile only) — PASS。以下来自本轮真实命令输出，工具链路径缩写。"
    },
    {
      "type": "details",
      "summary": "展开真实命令与输出",
      "blocks": [
        {
          "type": "code",
          "lang": "text",
          "text": "$ swiftc -swift-version 6 -parse-as-library -emit-module -module-name SteamProxyNativeWrapper -emit-module-path /private/tmp/sps3-swiftmodules/SteamProxyNativeWrapper.swiftmodule -module-cache-path /private/tmp/sps3-swift-module-cache -I bindings/swift/include bindings/swift/NativeEngine.swift\nexit: 0\n(no diagnostic output)\n$ swiftc -typecheck -swift-version 6 -I bindings/swift/include -I /private/tmp/sps3-swiftmodules -module-cache-path /private/tmp/sps3-swift-module-cache bindings/swift/tests/invalid-nul.swift\nexit: 0\n(no diagnostic output)"
        }
      ]
    },
    {
      "type": "text",
      "md": "Kotlin wrapper against Android SDK — PASS。以下来自本轮真实命令输出，工具链路径缩写。"
    },
    {
      "type": "details",
      "summary": "展开真实命令与输出",
      "blocks": [
        {
          "type": "code",
          "lang": "text",
          "text": "$ kotlinc bindings/kotlin/NativeEngine.kt -classpath <Android-SDK>/android-36/android.jar -d /private/tmp/sps3-kotlin.jar\nexit: 0\n(no diagnostic output)"
        }
      ]
    },
    {
      "type": "text",
      "md": "TypeScript declarations and source typing (compile only) — PASS。以下来自本轮真实命令输出，工具链路径缩写。"
    },
    {
      "type": "details",
      "summary": "展开真实命令与输出",
      "blocks": [
        {
          "type": "code",
          "lang": "text",
          "text": "$ node <installed-tsc> --noEmit --strict --module node16 --moduleResolution node16 --target es2022 --typeRoots <installed-node-types> bindings/ts/test/types.ts\nexit: 0\n(no diagnostic output)"
        }
      ]
    },
    {
      "type": "text",
      "md": "JavaScript syntax and patch whitespace — PASS。以下来自本轮真实命令输出，工具链路径缩写。"
    },
    {
      "type": "details",
      "summary": "展开真实命令与输出",
      "blocks": [
        {
          "type": "code",
          "lang": "text",
          "text": "$ node --check bindings/ts/lib/protocol.cjs\nexit: 0\n(no diagnostic output)\n$ node --check bindings/ts/lib/protocol-worker.cjs\nexit: 0\n(no diagnostic output)\n$ node --check bindings/ts/test/connection.test.cjs\nexit: 0\n(no diagnostic output)\n$ git diff --check\nexit: 0\n(no diagnostic output)"
        }
      ]
    },
    {
      "type": "heading",
      "level": 2,
      "text": "兼容性与失败边界"
    },
    {
      "type": "list",
      "items": [
        "C 保留旧 SpnConfig 布局和初始化器；Routes 使用独立扩展结构，读取扩展字段前检查版本与完整大小。静态断言锁定旧布局。",
        "入口 HTTP/TCP 独立于候选；离线策略调用 Rust configuration_policy，完整保留反代和隧道数组，不向摘要或 renderer 导出凭据。",
        "原生 actor 先校验再关闭旧实例，旧关闭失败不启动替代实例，新启动失败明确返回错误。TS Worker 排队生命周期操作，Swift/Kotlin 沿用各自锁。",
        "已加入 ABI、数组、JSON 到核心、切线失败、旧连接结束和 NUL 边界的未来回归用例；本次未运行这些用例。默认 Rust 测试源码和 Swift NUL 用例只作编译检查。"
      ]
    },
    {
      "type": "heading",
      "level": 2,
      "text": "独立评审"
    },
    {
      "type": "text",
      "md": "唯一正式评审轮次已记录在最终提交 `43923784669b8ea9882138cc6a7d8cc74c284ded`。同一独立 reviewer 在本轮核对最小修复后，报告剩余 blocker、major、minor 均为零。评审仅作只读代码与已有静态证据核对，没有运行回归。"
    },
    {
      "type": "text",
      "md": "本轮发现并修复：重启因队列拥塞被拒绝后，跟随的状态查询失败曾被误当成实例已停止，可能误关旧连接。最终代码等待查询入队、区分查询错误与确认无运行实例，并保留并发 stop 的 epoch 保护。修复后 Rust 静态检查再次通过；没有运行该拥塞场景的回归。"
    },
    {
      "type": "heading",
      "level": 2,
      "text": "Not proven"
    },
    {
      "type": "list",
      "items": [
        "依用户要求，dev 阶段未运行回归、端到端、语言测试矩阵；全部留待 main 阶段。",
        "运行时的重启成功、关闭失败、新启动失败和旧流终止尚未通过本次运行测试证明；新增用例不等于通过证据。",
        "未运行 native-tun 分支的测试；默认 cargo check --tests 不编译该分支的故障用例。",
        "未做完整动态链接、语言包产物构建或打包安装检查，也未检查所有 feature 组合。",
        "未验证 iOS/Android 实机或模拟器、Windows；静态编译不代表这些设备可用。",
        "未访问 Steam 或真实节点，未修改系统接管/CA 信任设置，未部署或发布。"
      ]
    }
  ]
};
