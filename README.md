# Herdr App：clone 后打开即用

这是 Herdr App 可直接读取的配置目录，包含 kansō 布局、主题、键位，以及 Magpie、Komari、Gitview、Cloudflare、TAPD 原生面板。

在已经安装 Herdr、Git，并具备此私仓访问权限的新 Mac 上，**在首次启动 Herdr App 前**执行：

```sh
git clone git@github.com:Kotodian/herdr-app-config.git ~/.config/herdr-app
```

然后正常打开 Herdr App。无需运行恢复、runtime、doctor 或 enable-auto 命令。

首次打开时，原生引导模块会自动：

1. 选择 kansō 布局，保留本机 core 会话。
2. 下载与本机 Apple Silicon / Intel 架构对应的 Gitview v0.5.0 执行文件，校验固定 SHA256，并生成本机路径配置。
3. 初始化本机同步基线和独立传输 checkout。
4. 注册登录时及每 5 分钟执行的自动双向同步任务。

底部“同步 ✓”显示同步状态，点击可立即同步。断网失败会显示“同步 !”，后续自动重试。另一台电脑初次接入也只需 clone 后打开 App。

## 适用条件

clone 的目标目录必须不存在或为空；Git 不会覆盖现有的配置目录。已有配置的电脑需要先保留原配置，再决定如何合并。当前主电脑已直接安装引导模块，无需重做 clone。

Git 与系统 Python 3 必须可用。GitHub 登录/SSH 权限在各台电脑预先配置；同步沿用本机 Git 凭据，不要求额外安装 GitHub CLI。

Magpie、Cloudflare、TAPD 的账号凭据不会进入 Git。已有本机连接的电脑会直接复用；新 Mac 需要自己的账号连接。Magpie 用量使用本机网关，TAPD 使用本机钥匙串，Komari 使用公开只读接口。kansō 的部分功能需要本机 Node.js。

## 自动同步规则

- 新增、修改的布局、主题、键位和自定义面板源码自动同步。
- 用本机上次成功同步的版本比较两边，合并不同文件上的改动。
- 同文件两边改成不同内容时停止覆盖，保留双方版本并记录错误。
- 删除操作不自动传播；涉及删除的差异需要明确处理。
- 收到模块代码先运行 `herdr-app check`，通过后备份并应用。
- 不同步凭据、shared.json、窗口状态、机器连接、缓存、终端文本或会话；不重启 core。
- 独立传输 checkout 位于 `~/.config/herdr-app-sync/repository`；无需手动操作它。clone 到 App 配置目录的工作区由同步器更新，不要再用 `git pull --force` 覆盖正在编辑的配置。

日志：`~/Library/Logs/HerdrAppSync.log`。
状态：`~/.config/herdr-app-sync/native-status.json`。
覆盖前备份：`~/.config/herdr-app/backups/github-sync-时间戳/`。

原来的 Herdr TUI 插件清单仍在 `Kotodian/herdr-plugins-sync`，保持原有同步任务；本仓库专门用于 Herdr App 的“clone 后直接使用”。
