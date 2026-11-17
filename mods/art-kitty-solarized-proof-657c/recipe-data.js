// Written by herdr-artifact from recipe.json.
export default {
  "recipe": 1,
  "blocks": [
    {
      "type": "text",
      "md": "已将普通窗口状态和 1100×720 尺寸写入 Kitty 默认启动 session，直接从 Dock 或应用程序启动即可读取，不再要求输入启动命令。\n玻璃参数保留为不透明度 0.50、模糊 8、暗灰青底色。用户实际查看后已确认“可以了”，三份配置已冻结。"
    },
    {
      "type": "table",
      "columns": ["项目", "此前", "本次保存后"],
      "rows": [
        ["启动状态", "建议用户输入普通窗口启动命令", "默认启动 session 固定 normal"],
        ["窗口尺寸", "仅配置初始宽高和关闭记忆", "启动 session 同时指定 1100×720 像素"],
        ["背景不透明度 / 模糊", "0.50 / 8", "保持不变"],
        ["背景底色", "#0b2024 暗灰青", "保持不变"],
        ["字体 / 标签", "Menlo 13 / 底部矩形", "保持不变"],
        ["正文 / 强调", "灰青 / 黄色", "保持不变"]
      ]
    },
    {
      "type": "text",
      "md": "验证：使用本机 Kitty 0.49.2 内置配置解析器读取实际文件，再由 create_sessions 读取配置指向的真实启动 session。核对普通窗口状态、像素尺寸及一个默认 shell；此解析未启动或操控窗口。以下为本次真实运行输出。"
    },
    {
      "type": "code",
      "lang": "text",
      "text": "PASS font_size: 13.0\nPASS background_opacity: 0.5\nPASS background_blur: 8\nPASS remember_window_size: False\nPASS initial_window_width: (1100, 'px')\nPASS initial_window_height: (720, 'px')\nPASS startup_session: '__HERDR_SYNC_HOME__/.config/kitty/startup.session'\nPASS tab_bar_style: 'separator'\nPASS tab_bar_min_tabs: 1\nPASS tab_title_template: '  {title}  '\nPASS enable_audio_bell: False\nPASS scrollback_lines: 10000\nPASS cursor_shape: 2\nPASS hide_window_decorations: 1\nPASS macos_show_window_title_in: 'menubar'\nPASS cursor_blink_interval: 0.7\nPASS configured startup session: one normal 1100x720 px OS window, one default shell\nPASS installed Menlo, bottom tabs, padding and all requested colors\nPASS Kitty 0.49.2 parsed the real configuration with zero errors"
    },
    {
      "type": "text",
      "md": "来源核对：实际下载并检查官方 kitty-themes 的 Solarized_Dark.conf，以其颜色表为起点调整正文、黄色和标签色。原 Mocha 文件保留，未修改 shell、Claude、tmux、nvim、字体安装或壁纸。"
    },
    {
      "type": "code",
      "lang": "text",
      "text": "Upstream: https://raw.githubusercontent.com/kovidgoyal/kitty-themes/master/themes/Solarized_Dark.conf\nDownloaded SHA-256:\nfc23242afc7cbbc7b6b97ac45a4607e1e9181d4823b42054dc3d9099fd9e1743\nkitty.conf SHA-256:\n1e76fedd1dc1b8d8379ed99c3ff6fa5506f8dcbfa764ac787e13166258a3159a\nstartup.session SHA-256:\n83da2d54a34166369b1bc310294c8c75220fddff2dc42d1faeda464ba0fded2f\nsolarized-glass.conf SHA-256:\n68736df9ffc837543aec0d077a4623974630217ad8e458486bb944ea2f8e5173"
    },
    {
      "type": "text",
      "md": "依据：本机文档确认 background_opacity 表示背景不透明度，background_blur 在 macOS 控制模糊半径；remember_window_size no 会改用 initial_window_width/height，不再继承上次最大化状态。本机 AppKit 实测 Reduce Transparency 为 false。参考图中可辨认的横竖轮廓来自背后的景物，配色本身无法生成这些轮廓；未改壁纸或其他应用。"
    },
    {
      "type": "text",
      "md": "如何生效：之后直接点击 Dock 中的 Kitty 或从应用程序打开即可，无需命令或额外参数。如果 Kitty 已在运行，请先保存或结束当前工作，再自行正常退出 Kitty，然后从图标重新打开；点击运行中的图标不会重新启动已有进程，startup_session 也不支持通过重载配置变更。代理没有关闭会话、删除 macOS Saved State 或修改系统偏好。"
    },
    {
      "type": "code",
      "lang": "text",
      "text": "kitty.conf:\nstartup_session startup.session\n\nstartup.session:\nos_window_state normal\nos_window_size 1100 720\nlaunch"
    },
    {
      "type": "details",
      "summary": "实际文件与复核方法",
      "blocks": [
        {
          "type": "code",
          "lang": "text",
          "text": "__HERDR_SYNC_HOME__/.config/kitty/kitty.conf\n__HERDR_SYNC_HOME__/.config/kitty/startup.session\n__HERDR_SYNC_HOME__/.config/kitty/themes/solarized-glass.conf\n\n/Applications/kitty.app/Contents/MacOS/kitty +runpy 'exec(open(\"/private/tmp/kitty-appearance-work/verify.py\").read())'\n\n上面的命令仅为技术复核方法，日常启动只需点击 Kitty 图标。\n本任务未做 Git 操作、备份或工作树。"
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
        "两张用户提供的图分别是参考图和第一版效果；最终效果没有新截图留证。用户已实际查看并确认“可以了”，该反馈不能替代代理截图证据。",
        "Computer Use 明确拒绝访问 Kitty；未换手段截图、打开或操控 Kitty，未实测从 Dock 启动或新窗口实际尺寸与合成后的玻璃效果。",
        "不同壁纸或背后窗口会呈现不同景物，未证明可完全复现参考素材；未修改壁纸或其他应用。"
      ]
    }
  ]
};
