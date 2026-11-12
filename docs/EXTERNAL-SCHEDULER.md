# A：外部定时（推荐）

> **使用风险自担，不保证不封号。** 配置前请阅读[免责声明](../README.md#免责声明)。

**用 cron-job.org 触发 GitHub，绕开原生 cron 漏触发。** 默认北京时间每天 09:30；领取仍在 GitHub Actions 执行，雀魂密码不用交给外部服务。

> **只跟本页操作，不用再配 B 方案。** 外部触发测试已通过；仍可能受令牌到期或 GitHub 执行故障影响。

## 1. 完成账号准备

先按 **[账号准备与手动测试](SETUP.md)** 完成 Fork、启用 Actions、填写邮箱密码，并确认手动运行成功。

然后进入自己仓库 **Settings → Secrets and variables → Actions → Variables**，新增或修改 `MAJSOUL_AUTO_ENABLED`，值填 **`false`**。这是关闭 B 的原生定时领取，**A 仍可正常触发**；GitHub 工作流保持启用。

## 2. 创建 GitHub 令牌

打开 [Fine-grained token 创建页](https://github.com/settings/personal-access-tokens/new)，填写：

| 项目 | 选择 |
|---|---|
| Token name | `majsoul-cron` |
| Expiration | 例如 90 天，自己记录到期日 |
| Resource owner | 自己的账号 |
| Repository access | **Only select repositories**，只选自己的 `majsoul-auto` |
| Repository permissions → Actions | **Read and write**，其他保持默认 |

点 **Generate token**。令牌稍后直接填进 cron-job.org，**不要放进仓库、Issue 或截图**。

## 3. 创建外部定时任务

在 [cron-job.org](https://console.cron-job.org/) 注册并验证邮箱，点击 **Create cronjob**：

| 项目 | 填写 |
|---|---|
| Title | 雀魂月卡自动领取 |
| URL | `https://api.github.com/repos/YOUR_USERNAME/majsoul-auto/actions/workflows/claim.yml/dispatches` |
| Timezone | **Asia/Shanghai** |
| 自定义 cron | `30 9 * * *`，每天北京时间 09:30 |
| Advanced → Request method | **POST** |
| Request body | `{"ref":"main"}` |

**把 `YOUR_USERNAME` 换成自己的 GitHub 用户名**，仓库改过名也要替换。若用时间选择器：小时选 **9**、分钟选 **30**，日期／月份／星期选全部。

在 **Advanced／高级设置** 添加请求头：

| Header | Value |
|---|---|
| `Authorization` | `Bearer 你的GitHub令牌`（中间一个空格） |
| `Accept` | `application/vnd.github+json` |
| `Content-Type` | `application/json` |
| `X-GitHub-Api-Version` | `2022-11-28` |

Basic authentication 不启用。无需 cron-job.org API Key，也不要填写雀魂密码。

## 4. 测试、启用、收邮件

1. 保存后点 **Test run**，确认 **HTTP status 为 204**；无响应正文是正常的。**不要公开 Raw request，它可能含令牌。**
2. 打开自己仓库的 Actions，确认出现新的 **workflow_dispatch** 运行，并查看 Summary 成功结束。**204 只表示接受触发，不代表已领取。**
3. 确认外部任务 **Enabled**，**Next execution** 为下一次北京时间 **09:30**。
4. 按 **[手机邮件通知](NOTIFICATIONS.md)** 开启 GitHub 邮件。下一个完整时段后，再确认外部 History 与 GitHub 运行记录对应。

完成。电脑可以关机，无需同时开启 B 方案。

## 以后如何维护

- **下午补跑（可选）**：外部 cron 改成 `30 9,15 * * *`；已领就跳过。
- **暂停 A**：到 cron-job.org 禁用任务；GitHub 的定时变量不能暂停 A。
- **令牌到期**：重建令牌，替换外部请求头，再做一次 Test run。
- **没邮件／报错**：[通知设置](NOTIFICATIONS.md) · [错误排查](FAQ.md#外部触发报错)。

[API 配置模板](../examples/cron-job.template.json)仅供进阶用户参考，默认禁用且包含占位符，提交模板不会创建任务。

[返回方案选择](../README.md#第一步选一种方案只跟对应教程操作)
