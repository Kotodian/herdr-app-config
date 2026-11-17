// Written by herdr-artifact from recipe.json.
export default {
  "recipe": 1,
  "blocks": [
    {
      "type": "text",
      "md": "用户确认第一版遮罩太厚、模糊太重后，本次已降低背景不透明度与模糊，改用更中性的暗灰青底色。\n新窗口不再记住铺满屏幕的尺寸，按普通窗口 1100×720 启动。最终玻璃观感仍待用户查看。"
    },
    {
      "type": "table",
      "columns": ["项目", "用户反馈时", "本次保存后"],
      "rows": [
        ["背景不透明度 / 模糊", "0.78 / 32", "0.50 / 8"],
        ["背景底色", "#002b36 深蓝青", "#0b2024 暗灰青"],
        ["窗口尺寸", "记住上次尺寸和最大化状态", "不记忆，初始 1100×720 像素"],
        ["字体 / 标签", "Menlo 13 / 底部矩形", "保持不变"],
        ["正文 / 强调", "灰青 / 黄色", "保持不变"]
      ]
    },
    {
      "type": "text",
      "md": "验证：使用本机 Kitty 0.49.2 内置配置解析器读取实际配置，检查主题颜色、已安装字体及保留的行为设置。以下为本次真实运行输出。"
    },
    {
      "type": "code",
      "lang": "text",
      "text": "PASS font_size: 13.0\nPASS background_opacity: 0.5\nPASS background_blur: 8\nPASS remember_window_size: False\nPASS initial_window_width: (1100, 'px')\nPASS initial_window_height: (720, 'px')\nPASS tab_bar_style: 'separator'\nPASS tab_bar_min_tabs: 1\nPASS tab_title_template: '  {title}  '\nPASS enable_audio_bell: False\nPASS scrollback_lines: 10000\nPASS cursor_shape: 2\nPASS hide_window_decorations: 1\nPASS macos_show_window_title_in: 'menubar'\nPASS cursor_blink_interval: 0.7\nPASS installed Menlo, bottom tabs, padding and all requested colors\nPASS Kitty 0.49.2 parsed the real configuration with zero errors"
    },
    {
      "type": "text",
      "md": "来源核对：实际下载并检查官方 kitty-themes 的 Solarized_Dark.conf，以其颜色表为起点调整正文、黄色和标签色。原 Mocha 文件保留，未修改 shell、Claude、tmux、nvim、字体安装或壁纸。"
    },
    {
      "type": "code",
      "lang": "text",
      "text": "Upstream: https://raw.githubusercontent.com/kovidgoyal/kitty-themes/master/themes/Solarized_Dark.conf\nDownloaded SHA-256:\nfc23242afc7cbbc7b6b97ac45a4607e1e9181d4823b42054dc3d9099fd9e1743\nkitty.conf SHA-256:\n670ae4ab77072a5a06c44e1f920452424cd195d6f0afb7666af47a2c853a7024\nsolarized-glass.conf SHA-256:\n68736df9ffc837543aec0d077a4623974630217ad8e458486bb944ea2f8e5173"
    },
    {
      "type": "text",
      "md": "依据：本机文档确认 background_opacity 表示背景不透明度，background_blur 在 macOS 控制模糊半径；remember_window_size no 会改用 initial_window_width/height，不再继承上次最大化状态。本机 AppKit 实测 Reduce Transparency 为 false。参考图中可辨认的横竖轮廓来自背后的景物，配色本身无法生成这些轮廓；未改壁纸或其他应用。"
    },
    {
      "type": "text",
      "md": "如何生效：保留现有会话，在终端执行下方命令，启动独立 Kitty 进程的普通窗口。新标签不会改变现有窗口尺寸，单纯重载也无法保证原进程的透明度变化。当前窗口如在全屏，需用户先退出全屏；本次未操控或关闭任何窗口。"
    },
    {
      "type": "code",
      "lang": "sh",
      "text": "open -na /Applications/kitty.app --args --start-as normal"
    },
    {
      "type": "details",
      "summary": "实际文件与复核方法",
      "blocks": [
        {
          "type": "code",
          "lang": "text",
          "text": "__HERDR_SYNC_HOME__/.config/kitty/kitty.conf\n__HERDR_SYNC_HOME__/.config/kitty/themes/solarized-glass.conf\n\n/Applications/kitty.app/Contents/MacOS/kitty +runpy 'exec(open(\"/private/tmp/kitty-appearance-work/verify.py\").read())'\n\n本任务未做 Git 操作、备份或工作树。"
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
        "两张用户提供的图分别是参考图和第一版效果；本次修正后没有新效果图，不能宣称已与参考一致。",
        "Computer Use 明确拒绝访问 Kitty；未换手段截图、打开或操控 Kitty，未确认新窗口实际尺寸与合成后的玻璃效果。",
        "仍需用户用普通新窗口确认背景轮廓与正文可读性。不同壁纸或背后窗口会呈现不同景物，不保证完全复现参考素材。"
      ]
    }
  ]
};
