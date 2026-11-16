# 决策模型

在 Settings → Agents → **Decision model · 决策模型** 中独立选择模型、推理强度和 Fast。可选模型来自现有 Codex/Claude 模型列表，包括自定义 provider 的模型。默认显示“Choose model…”；未选择时不代替用户选模型，已有任务继续运行。

Claude Code、Codex 两个页签都列出 Typesafe 的决策模型，并显示 Typesafe 图标。目前目录提供 `typesafe/jev-latest` 和 `typesafe/jev-preview`。在任意一边选择即可；保留原来的两个 agent，不新增厂商页签。重新打开设置会重新读取目录。

Typesafe Jev 使用分类接口，不提供推理强度或 Fast。它按任务类型、风险、复杂度及评审/证据要求分类；程序将分类转换为既定流程、说明和验证步骤。调用沿用所选 agent 的 provider 地址和凭据，不要求另填 Typesafe 密钥。其他角色继续使用各自的对话模型。

决策模型只分析请求，Assistant 负责规划协调，Worker 执行，Reviewer 独立评审。决策结果包括任务类型、执行方式、风险、复杂度、建议步骤、验证要求和理由。它可以区分普通开发、生产修复、调研、评审、配置、发布等，功能不限于选择 Git 分支。

选择后，`herdr-task add` 在创建任务前调用它；调用期间不锁任务列表。失败或分类不明确时不会创建任务或回退到其他模型。只读调研/评审及上线请求交回 Assistant 处理。已有任务保留原简报，不会被自动重新分类。

Assistant 也可以先分类完整请求：

```sh
herdr-task decide "用户请求" --prompt-file /tmp/request.md --folder /path/to/repo --json
```

创建代码任务时可复用同一请求的结果，避免重复调用：

```sh
herdr-task decide "修复登录" --prompt-file /tmp/task.md --folder /path/to/repo --json > /tmp/decision.json
herdr-task add "修复登录" --prompt-file /tmp/task.md --folder /path/to/repo --decision-file /tmp/decision.json
```

缓存只接受相同目录、标题和简报。拆分后的不同任务各自分类。结果保存在任务的 `decision` 字段，通过 `herdr-task show <id> --json` 查看完整记录，普通 show 和 Worker 简报也包含分类理由和验证要求。

确需调整时，创建任务可显式指定 `--workflow development` 或 `--workflow hotfix`，保留原始推荐和覆盖记录。已创建工作树的任务修改流程必须同时指定 `--base`，仅允许旧、新基线指向同一提交且没有 PR 的安全调整；否则先人工整合。

启用此安装的 `git-workflow.json` 时，普通开发从 dev 分支到 dev；明确修复 main/生产已有 bug 的 hotfix 从 main 分支到 main。PR 实际目标也必须匹配。只有本次明确的上线指令授权 dev 到 main、tag 或生产部署；模型分类本身不提供上线授权。

分类器沿用所选 agent 的 provider 和登录信息。普通模型以临时只读会话调用，禁用 hooks、连接工具及项目执行；Typesafe 模型使用原生分类接口，两者都不启动 Worker。决策角色的权限选择不改变这个只读边界。
