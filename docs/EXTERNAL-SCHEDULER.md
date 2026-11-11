# 外部云端定时器：cron-job.org

**用途：GitHub 原生定时可能延迟或不触发，而手动 Run workflow 正常时，用独立服务按时调用同一个工作流。** 领取仍由 GitHub Actions 执行，雀魂账号密码仍只保存在自己的 GitHub Secrets 中。

**验证记录（2026-11-11）：使用者完成注册和配置，Test run 返回 HTTP 204，对应 Actions 运行成功。当前外部任务选择每天北京时间 09:30；实际自动定时仍需观察下一次执行。** 这不代表 Fork 后会自动继承设置：每位使用者都需要自行注册、验证邮箱、创建令牌和启用任务。

先按 [README](../README.md) 完成自己的仓库和邮箱密码 Secrets 配置，并确认手动运行成功，再执行以下步骤。

## 1. 注册和创建限定权限令牌

1. 在 https://console.cron-job.org/ 注册账号并验证邮箱。
2. 打开 https://github.com/settings/personal-access-tokens/new ，创建 Fine-grained personal access token。
3. Resource owner 选你自己。Repository access 选 **Only select repositories**，只选择你部署的 `majsoul-auto` 仓库。
4. Repository permissions 中只增加 **Actions: Read and write**。Metadata 读取权限为 GitHub 必需项。不要选择所有仓库或增加 Contents／管理权限。
5. 设置合理的到期日，例如 90 天，并在自己的日历中记录更换日期。组织策略可能要求审批；Pending 令牌不能直接使用。
6. 创建后将令牌直接填进下方 cron-job.org 请求头。不要发到聊天、Issue、仓库文件或截图里；如果意外公开，立即撤销重建。

## 2. 在 cron-job.org 创建任务

在 Cronjobs 页面选择创建任务，填写：

| 配置 | 值 |
|---|---|
| 标题 | 雀魂月卡每日检查与补领 |
| URL | `https://api.github.com/repos/YOUR_USERNAME/majsoul-auto/actions/workflows/claim.yml/dispatches` |
| 时区 | `Asia/Shanghai` |
| 自定义 cron | `30 9 * * *`（每天北京时间 09:30） |
| Request method | `POST` |
| Request body | `{"ref":"main"}` |
| Basic authentication | 不启用 |
| Save responses | 可关闭；成功响应无正文 |
| 失败通知 | 建议打开，首次失败即通知；这仅监测触发请求，不代表领取结果 |

**把 URL 中的 `YOUR_USERNAME` 换成自己的 GitHub 用户名**；仓库改过名的也要替换 `majsoul-auto`。例如本项目作者使用 `wlog0654/majsoul-auto`，不要照抄作者的目标仓库。

不同版本界面可能将请求设置放在 **Advanced／高级设置** 部分。如果使用分钟／小时选择器：分钟选 **30**，小时选 **9**，日期／月份／星期选全部。时区必须确认是 **Asia/Shanghai**，此处填写北京时间，不用再减 8 小时。

可选下午补跑：自定义 cron 改为 `30 9,15 * * *`，或小时同时选择 9 和 15。下午会先查状态，已领则跳过。

添加请求头：

| Header | Value |
|---|---|
| `Authorization` | `Bearer ` 后接你刚创建的 GitHub 令牌（Bearer 与令牌间保留一个空格） |
| `Accept` | `application/vnd.github+json` |
| `Content-Type` | `application/json` |
| `X-GitHub-Api-Version` | `2022-11-28` |
| `User-Agent` | `majsoul-auto-scheduler`（若界面不提供，服务默认 User-Agent 也可） |

不要把令牌放进 URL、请求正文或 Basic authentication 密码框。令牌会保存在 cron-job.org，意味着你授权该服务使用它触发指定仓库的 Actions。

用于 API 客户端参考的完整配置见 [模板](../examples/cron-job.template.json)。该模板不是 GitHub 工作流，也不会因提交到仓库而生效；模板默认 disabled 且包含占位符，必须在私密环境替换仓库路径和令牌后才能经 cron-job.org 的创建接口使用。普通网页配置不需要额外的 cron-job.org API Key。

## 3. 先测试再启用

1. 保存并执行 cron-job.org 的 Test run／立即执行。
2. 预期 GitHub HTTP 响应为 **204**。这仅表示触发请求已接受，不表示雀魂已领取。
3. 打开自己的 GitHub 仓库 Actions，确认出现一条新的 `workflow_dispatch` 运行，随后检查 Summary，并验证邮件是否送达。
4. 成功后启用 cron-job.org 任务，检查 Next execution 是否为下一次北京时间 09:30（如果开启下午补跑，也可能为 15:30）。
5. 第一次完整定时执行后，再确认 cron-job.org 的 History 和 GitHub 新运行时间对应。手动 Test run 成功不能替代定时验收。

原生 GitHub 定时目前仍保留。外部测试成功后，可把 Repository Variable `MAJSOUL_AUTO_ENABLED` 设为 `false`，暂停原生定时的领取部分，减少重复登录；原生配置检查仍可能运行。**外部请求使用 workflow_dispatch，不受这个变量控制。暂停外部触发必须在 cron-job.org 禁用该任务**；在 GitHub Disable workflow 会同时停止所有来源。

### Response、Raw response 和 Raw request 怎么看

只需查看 **HTTP status**，并到 GitHub 确认新运行。返回 204 时没有正文是正常的。**不要公开 Raw request**：其中可能包含 Authorization 令牌；截图也要遮住请求头。只贴响应头却没有 HTTP 状态码，不能单凭这些头判断成功。

响应里的 Deprecation／Sunset 是 API 版本生命周期提示，不等于本次请求失败；以 HTTP 状态和 Actions 结果为准，并留意未来迁移提示。

## 4. 邮件通知和暂停

如果 GitHub 通知发到了教育邮箱，按 [添加个人邮箱并切换默认通知地址](../README.md#把通知发到个人邮箱保留教育邮箱) 操作：添加个人邮箱 → 邮件验证 → Default notifications email 选择个人邮箱。不需要改主邮箱或 Git 提交邮箱，但会影响其他使用默认地址的 GitHub 通知。Custom routing 主要适用于组织，不能用来单独路由这个个人仓库。

原有 GitHub Actions 邮件通知可以继续使用，见 [README 的手机邮件设置](../README.md#开启手机邮件通知)。外部调度器使用你的 GitHub 令牌发送 workflow_dispatch，仍需实际测试收件，不能只依赖 cron-job.org 的触发成功提示。

cron-job.org 的失败通知监测的是“有没有成功调用 GitHub”，不一定能发现 GitHub 后续领取失败；领取结果看 Actions 邮件与 Summary。没有成功执行定时任务时也不保证一定收到 GitHub 完成邮件。

| 要做什么 | 操作 |
|---|---|
| 只用外部定时、暂停原生定时领取 | 外部 Test run 验证成功后，将 Repository Variable `MAJSOUL_AUTO_ENABLED` 改为 `false` |
| 暂停外部触发 | 在 cron-job.org 禁用该任务；GitHub 中的定时变量对它不起作用 |
| 暂停所有触发来源 | 在 GitHub Disable workflow，同时禁用外部任务 |
| 恢复外部触发 | GitHub 工作流保持启用，在 cron-job.org 重新启用任务 |

原生和外部可以同时保留；若都触发，会串行执行，已领取时跳过，但可能多次登录和收到多封邮件。建议选一种日常触发方式。

## 5. 常见错误和维护

| HTTP 状态或现象 | 排查 |
|---|---|
| 401 | 令牌错误、过期或已撤销 |
| 403 | 权限不足、账号／组织限制、令牌审批或 API 限流 |
| 404 | 仓库／工作流路径错误，或令牌没有目标仓库访问权 |
| 422 | ref、请求体或 workflow_dispatch 配置不符合要求 |
| 204，但没有立即看到运行 | 检查目标仓库、默认分支和 Actions 状态，稍后刷新；204 不保证任务立即开始 |
| History 触发成功但 GitHub 任务失败 | 外部调度已完成，继续检查登录、版本和领取日志 |

令牌到期前在 GitHub 重建，并更新 cron-job.org 的 Authorization 请求头，再执行一次 Test run 验证。令牌撤销或泄露时也按此步骤更换。GitHub 邮件设置继续生效，但外部调度成功和领取成功是两个阶段，应分别确认。GitHub 调度不再参与外部触发时刻，Actions 执行排队和服务故障仍可能影响完成时间。

参考：[cron-job.org API 文档](https://docs.cron-job.org/rest-api.html)、[GitHub workflow dispatch API](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event)。
