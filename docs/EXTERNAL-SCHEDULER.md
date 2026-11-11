# 外部云端定时器：cron-job.org

**状态：提供配置模板；尚未在你的 cron-job.org 账号中创建或启用任务。** 注册、验证邮箱和创建 GitHub 令牌需要账号所有者完成。无需提供雀魂密码给新服务。

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
| URL | `https://api.github.com/repos/wlog0654/majsoul-auto/actions/workflows/claim.yml/dispatches` |
| 时区 | `Asia/Shanghai` |
| 自定义 cron | `30 9,15 * * *`（北京时间 09:30、15:30） |
| Request method | `POST` |
| Request body | `{"ref":"main"}` |
| Basic authentication | 不启用 |
| Save responses | 可关闭；成功响应无正文 |
| 失败通知 | 建议打开，首次失败即通知；这仅监测触发请求，不代表领取结果 |

其他用户必须把 URL 中的 `wlog0654/majsoul-auto` 改成自己的仓库。不同版本界面可能将请求设置放在 Advanced 部分；如果使用分钟／小时选择器，分钟选 30，小时选 9 和 15，日期／月份／星期选全部。

添加请求头：

| Header | Value |
|---|---|
| `Authorization` | `Bearer ` 后接你刚创建的 GitHub 令牌（Bearer 与令牌间保留一个空格） |
| `Accept` | `application/vnd.github+json` |
| `Content-Type` | `application/json` |
| `X-GitHub-Api-Version` | `2022-11-28` |
| `User-Agent` | `majsoul-auto-scheduler`（若界面不提供，服务默认 User-Agent 也可） |

不要把令牌放进 URL、请求正文或 Basic authentication 密码框。令牌会保存在 cron-job.org，意味着你授权该服务使用它触发指定仓库的 Actions。

用于 API 客户端参考的完整配置见 [模板](../examples/cron-job.template.json)。该模板不是 GitHub 工作流，也不会因提交到仓库而生效；模板默认 disabled 且包含占位符，必须在私密环境替换令牌后才能经 cron-job.org 的创建接口使用。普通网页配置不需要额外的 cron-job.org API Key。

## 3. 先测试再启用

1. 保存并执行 cron-job.org 的 Test run／立即执行。
2. 预期 GitHub HTTP 响应为 **204**。这仅表示触发请求已接受，不表示雀魂已领取。
3. 打开自己的 GitHub 仓库 Actions，确认出现一条新的 `workflow_dispatch` 运行，随后检查 Summary，并验证邮件是否送达。
4. 成功后启用 cron-job.org 任务，检查 Next execution 是否为北京时间 09:30 或 15:30。
5. 第一次完整定时执行后，再确认 cron-job.org 的 History 和 GitHub 新运行时间对应。手动 Test run 成功不能替代定时验收。

原生 GitHub 定时目前仍保留。外部测试成功后，可把 Repository Variable `MAJSOUL_AUTO_ENABLED` 设为 `false`，暂停原生定时的领取部分，减少重复登录；原生配置检查仍可能运行。**外部请求使用 workflow_dispatch，不受这个变量控制。暂停外部触发必须在 cron-job.org 禁用该任务**；在 GitHub Disable workflow 会同时停止所有来源。

## 4. 常见错误和维护

| HTTP 状态或现象 | 排查 |
|---|---|
| 401 | 令牌错误、过期或已撤销 |
| 403 | 权限不足、账号／组织限制、令牌审批或 API 限流 |
| 404 | 仓库／工作流路径错误，或令牌没有目标仓库访问权 |
| 422 | ref、请求体或 workflow_dispatch 配置不符合要求 |
| 204，但没有立即看到运行 | 检查目标仓库、默认分支和 Actions 状态，稍后刷新；204 不保证任务立即开始 |
| History 触发成功但 GitHub 任务失败 | 外部调度已完成，继续检查登录、版本和领取日志 |

令牌到期前在 GitHub 重建，并更新 cron-job.org 请求头。GitHub 邮件设置继续生效，但外部调度成功和领取成功是两个阶段，应分别确认。GitHub 调度不再参与外部触发时刻，Actions 执行排队和服务故障仍可能影响完成时间。

参考：[cron-job.org API 文档](https://docs.cron-job.org/rest-api.html)、[GitHub workflow dispatch API](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event)。
