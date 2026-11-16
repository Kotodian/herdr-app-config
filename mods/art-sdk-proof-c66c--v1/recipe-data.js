// Written by herdr-artifact from recipe.json.
export default {
  "recipe": 1,
  "blocks": [
    {
      "type": "text",
      "md": "新增统一离线检查入口：可选择 Rust、纯 Go 或两者，先看计划，再重复执行当前工作树的测试。自动下载关闭；失败、缺工具、超时和中断均真实报告。仅新增约定的三个文件，保留未提交结果。"
    },
    {
      "type": "stats",
      "items": [
        {"label": "Rust 默认矩阵", "value": "2 / 2", "note": "默认与无默认特性通过"},
        {"label": "Go 默认矩阵", "value": "9 / 9", "note": "含 race、单能力与组合"},
        {"label": "入口边界测试", "value": "15 / 15", "note": "临时假工具，非 SDK 证明"}
      ]
    },
    {
      "type": "text",
      "md": "使用方式：从仓库根运行以下命令；从其他目录可传入脚本绝对路径，工作目录仍定位到当前仓库。"
    },
    {
      "type": "code",
      "lang": "sh",
      "text": "python3 tools/check-sdk.py\npython3 tools/check-sdk.py --help\npython3 tools/check-sdk.py --dry-run\npython3 tools/check-sdk.py --suite go\npython3 tools/check-sdk.py --suite rust --timeout 600\npython3 tools/check-sdk.py --extended --dry-run\npython3 -B -m unittest discover -s tools -p test_check_sdk.py -v"
    },
    {
      "type": "heading",
      "level": 2,
      "text": "当前工作树的真实 SDK 输出"
    },
    {
      "type": "text",
      "md": "Rust：实际执行默认入口，锁文件检查及两项 Rust 检查通过；以下为 default.txt 的原始结果行。"
    },
    {
      "type": "code",
      "lang": "text",
      "text": "$ cargo test --offline --locked\n[rust/default] PASS (exit 0, 128.6s)\n\n$ cargo test --offline --locked --no-default-features\n[rust/no-default-features] PASS (exit 0, 21.0s)"
    },
    {
      "type": "callout",
      "tone": "info",
      "title": "首次 Go 执行受沙箱阻塞，已保留失败",
      "md": "默认入口首次运行时，Go 九项均因现有编译缓存访问被沙箱拒绝而失败，总退出码为一；未计为通过。随后获准在沙箱外仅重跑 Go 九项，继续使用相同离线约束，全部通过。没有重复运行 Rust 来补绿色输出。"
    },
    {
      "type": "text",
      "md": "Go：实际执行 python3 -B tools/check-sdk.py --suite go；以下为 go.txt 原始结果行，完整输出保存在同一证明目录。"
    },
    {
      "type": "code",
      "lang": "text",
      "text": "[go/default] PASS (exit 0, 1.0s)\n[go/race] PASS (exit 0, 2.5s)\n[go/reverse_proxy] PASS (exit 0, 0.8s)\n[go/tunnel_proxy] PASS (exit 0, 0.7s)\n[go/vless_xhttp] PASS (exit 0, 1.0s)\n[go/websocket] PASS (exit 0, 0.8s)\n[go/shadowsocks] PASS (exit 0, 0.8s)\n[go/reverse-vless] PASS (exit 0, 1.0s)\n[go/combined] PASS (exit 0, 1.1s)\n\nResult: 9 commands completed, 0 failed, 0 not run."
    },
    {
      "type": "heading",
      "level": 2,
      "text": "入口边界证明"
    },
    {
      "type": "text",
      "md": "stdlib unittest 使用临时可执行假工具验证参数、空格路径、离线环境、错误码、缺工具、锁文件前提、超时、SIGINT / SIGTERM、中断后代清理、成功后的后代清理及 JSON 凭据遮盖；以下为 unittest.txt 的实际输出节选，测试名省略类路径。"
    },
    {
      "type": "code",
      "lang": "text",
      "text": "test_child_signal_exit_is_reported ... ok\ntest_default_matrix_directories_arguments_and_offline_environment ... ok\ntest_escaped_session_cannot_extend_cleanup_wait ... ok\ntest_first_failure_is_preserved_and_all_go_checks_run ... ok\ntest_help_and_dry_run_do_not_require_tools_or_lockfile ... ok\ntest_interrupt_during_timeout_cleanup_is_not_lost ... ok\ntest_interrupt_stops_descendants_and_stops_matrix ... ok\ntest_invalid_options_fail_before_any_command ... ok\ntest_missing_tool_fails ... ok\ntest_nonexecutable_tool_fails_to_start ... ok\ntest_output_redacts_urls_and_credential_lines_but_keeps_failure ... ok\ntest_rust_only_and_extra_combination_is_unfiltered ... ok\ntest_success_also_cleans_detached_output_descendants ... ok\ntest_timeout_stops_stubborn_child_even_after_parent_exits ... ok\ntest_untracked_or_deleted_lockfile_blocks_only_rust ... ok\n\nRan 15 tests in 25.510s\n\nOK"
    },
    {
      "type": "text",
      "md": "评审发现的首次中断丢失：同一真实时序用例先在修复前失败，修复后纳入完整测试通过。清理期间收到中断现在会记录请求，清理后退出并停止后续矩阵。"
    },
    {
      "type": "code",
      "lang": "text",
      "text": "Before · interrupt-before.txt\ntest_interrupt_during_timeout_cleanup_is_not_lost ... FAIL\nAssertionError: 124 != 130\nRan 1 test in 6.386s\nFAILED (failures=1)\n\nAfter · unittest.txt\ntest_interrupt_during_timeout_cleanup_is_not_lost ... ok\nRan 15 tests in 25.510s\nOK"
    },
    {
      "type": "text",
      "md": "JSON 凭据遮盖：最终代码的直接探针确认敏感值未被保留；真实假工具回归也覆盖同一格式并保持失败码。"
    },
    {
      "type": "code",
      "lang": "text",
      "text": "JSON credential retained: False"
    },
    {
      "type": "text",
      "md": "独立评审：一轮只读审查已记录。JSON 遮盖、有界清理、普通退出码一百三十、进程查询断言及清理期间首次中断问题均已修复。最后一项修复有真实失败前证据及通过后的十五项测试；受一轮上限限制，没有再开独立复审。源码最终检查入口 SHA256 前缀：b3cf63f507ad。"
    },
    {
      "type": "text",
      "md": "帮助与 dry-run：真实运行 --help、--dry-run 均退出零；dry-run 输出十二条命令（含锁文件前提），不启动工具。完整输出见同目录 help.txt 与 dry-run.txt。"
    },
    {
      "type": "code",
      "lang": "text",
      "text": "DRY RUN: 12 commands; no tool or cache availability verified."
    },
    {
      "type": "heading",
      "level": 2,
      "text": "Not proven"
    },
    {
      "type": "list",
      "items": [
        "未合并的 SPS-1 / SPS-2 路由实现没有纳入本次验证；所有 SDK 结果仅属于本任务当前工作树。",
        "未运行 extended 或额外 Rust 纯隧道组合；已知纯隧道组合的两项旧 HTTP 假设失败不会被过滤或跳过。",
        "没有验证真实 Steam、生产代理、真实节点、系统接管、证书信任、部署或其他语言绑定。",
        "未证明跨平台行为；实际执行环境为 macOS arm64，当前入口需要 POSIX 进程组。",
        "离线参数限制依赖下载，不是操作系统级网络沙箱；新增 SDK 测试仍必须遵守本地监听边界。",
        "清理契约覆盖当前进程组内的测试后代，不覆盖主动 setsid 逃逸的守护进程；真实逃逸管道测试只证明最终等待有界，逃逸进程由夹具回收。",
        "没有独立复审最后的首次中断修复：唯一评审轮已用完，最终十五项通过属于 worker 的真实回归证据。",
        "尚未获得提交、推送或 PR 授权，因此不执行 Git 写入，也不调用要求已提交状态的 ready。评审记录明确说明审查对象为未提交工作树，不冒称基线提交包含新增工具。"
      ]
    }
  ]
};
