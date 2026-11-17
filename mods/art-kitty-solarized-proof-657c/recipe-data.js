// Written by herdr-artifact from recipe.json.
export default {
  "recipe": 1,
  "blocks": [
    {
      "type": "text",
      "md": "已按参考图调整 Kitty：深蓝青背景、灰青正文、黄色强调、底部蓝青矩形标签及更紧凑的 Menlo 字体。\n保存透明度与磨砂设置；下次启动 Kitty 后完整生效。"
    },
    {
      "type": "table",
      "columns": ["项目", "修改前", "保存后"],
      "rows": [
        ["字体 / 行高", "Menlo 15 / 110%", "Menlo 13 / 100%"],
        ["内边距", "14", "8"],
        ["背景透明度 / 模糊", "1.0 / 0", "0.78 / 32"],
        ["标签栏", "顶部斜角，至少两个标签", "底部矩形，单标签也显示"],
        ["活动 / 非活动标签", "Mocha 主题", "亮蓝底深色字 / 深青底灰字"]
      ]
    },
    {
      "type": "text",
      "md": "验证：使用本机 Kitty 0.49.2 内置配置解析器读取实际配置，检查主题颜色、已安装字体及保留的行为设置。以下为本次真实运行输出。"
    },
    {
      "type": "code",
      "lang": "text",
      "text": "PASS font_size: 13.0\nPASS background_opacity: 0.78\nPASS background_blur: 32\nPASS tab_bar_style: 'separator'\nPASS tab_bar_min_tabs: 1\nPASS tab_title_template: '  {title}  '\nPASS enable_audio_bell: False\nPASS scrollback_lines: 10000\nPASS cursor_shape: 2\nPASS hide_window_decorations: 1\nPASS macos_show_window_title_in: 'menubar'\nPASS cursor_blink_interval: 0.7\nPASS installed Menlo, bottom tabs, padding and all requested colors\nPASS Kitty 0.49.2 parsed the real configuration with zero errors"
    },
    {
      "type": "text",
      "md": "来源核对：实际下载并检查官方 kitty-themes 的 Solarized_Dark.conf，以其颜色表为起点调整正文、黄色和标签色。原 Mocha 文件保留，未修改 shell、Claude、tmux、nvim、字体安装或壁纸。"
    },
    {
      "type": "code",
      "lang": "text",
      "text": "Upstream: https://raw.githubusercontent.com/kovidgoyal/kitty-themes/master/themes/Solarized_Dark.conf\nDownloaded SHA-256:\nfc23242afc7cbbc7b6b97ac45a4607e1e9181d4823b42054dc3d9099fd9e1743\nkitty.conf SHA-256:\n5c7cc0fc5e7d03b9e8fc082e0f39de42b3dc3e6f2051ba919a864b327175a6d0\nsolarized-glass.conf SHA-256:\nfc0eb506565d00b498cc955b80e8dae6b9cea26864d15c13ea5497cd1348e390"
    },
    {
      "type": "text",
      "md": "生效检查：初查存在 Kitty 进程；准备重载前按程序路径复查及再次搜索 kitty/kitten 均无结果。未发送信号，未终止会话。下次直接启动 Kitty 即可读取全部配置。原进程未开启动态透明度，因此若旧进程仍存在，单纯重载不能完整改变透明度，需保留工作并稍后重启该进程。"
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
        "未做 Kitty 窗口视觉验证：Computer Use 明确拒绝访问 Kitty；遵照要求未换手段截图。",
        "未确认 macOS 合成后的磨砂强度、桌面透色、文字可读性或与参考图的视觉贴合程度。",
        "未确认运行中配置重载：执行前 Kitty 已不再运行。"
      ]
    }
  ]
};
