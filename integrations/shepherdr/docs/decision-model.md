# 决策模型

在 Settings → Agents → **Decision model · 决策模型** 中独立选择模型、推理强度和 Fast。可选模型来自现有 Codex/Claude 模型列表，包括自定义 provider 的模型。默认显示“Choose model…”；未选择时不代替用户选模型，已有任务继续运行。

Claude Code、Codex 两个页签都列出 Typesafe 的决策模型，并显示 Typesafe 图标。目前目录提供 `typesafe/jev-latest` 和 `typesafe/jev-preview`。在任意一边选择即可；保留原来的两个 agent，不新增厂商页签。重新打开设置会重新读取目录。

Typesafe Jev 使用分类接口，不提供推理强度或 Fast。调用沿用所选 agent 的 provider 地址和凭据，不要求另填 Typesafe 密钥。其他角色继续使用各自的对话模型。

分类器只返回 `{"task_type":"bug"}` 或 `{"task_type":"feature"}`。Assistant 根据复现环境、部署版本和对应的提交判断缺陷范围，并决定是否调用 Debugger、如何拆分任务以及如何验收。调研、评审和发布等请求由 Assistant 直接处理。

配置模型后，`herdr-task add` 在创建任务前调用它。调用期间不锁任务列表。分类失败时不会创建任务或回退到其他模型。已有任务保留原来的记录。

Assistant 也可以先分类完整请求：

```sh
herdr-task decide "用户请求" --prompt-file /tmp/request.md --folder /path/to/repo --json
```

创建代码任务时可复用同一请求的结果，避免重复调用：

```sh
herdr-task decide "修复登录" --prompt-file /tmp/task.md --folder /path/to/repo --json > /tmp/decision.json
herdr-task add "修复登录" --prompt-file /tmp/task.md --folder /path/to/repo \
  --decision-file /tmp/decision.json --workflow development
```

本例中，Assistant 已确认缺陷只影响 `dev`。缓存只接受相同目录、标题和简报。旧格式的缓存需要重新分类。结果保存在任务的 `decision` 字段，可用 `herdr-task show <id> --json` 查看。

启用 `git-workflow.json` 的 Git 仓库里，分类为 `bug` 时，创建任务需要显式指定 `--workflow development` 或 `--workflow hotfix`。缺陷归属不明时，Assistant 先核实影响范围。只在 `dev` 或 Worker 的改动中出现的缺陷由 Worker 自行处理。确认影响 `main` 或其生产版本后，Assistant 可调用只读 Debugger，把定位结果交给 Worker，再用 `--workflow hotfix --base main` 创建修复任务。Worker 从 `main` 开分支并向 `main` 提 PR。

普通开发从 `dev` 开分支并向 `dev` 提 PR。已创建工作树的任务修改流程须同时指定 `--base`，且新旧基线必须指向同一提交、没有 PR。`dev` 合入 `main`、打发布 tag 或部署生产遵循本次明确的上线指令。

分类器沿用所选 agent 的 provider 和登录信息。普通模型以临时只读会话调用，禁用 hooks、连接工具及项目执行；Typesafe 模型使用原生分类接口，两者都不启动 Worker。决策角色的权限选择不改变这个只读边界。
