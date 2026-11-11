# 手机邮件通知（A、B 共用）

不需要给本项目配置邮箱密码或 SMTP：直接使用 GitHub 的工作流邮件通知。

1. 打开 [GitHub 个人通知设置](https://github.com/settings/notifications)。这是个人账号设置，不是仓库 Secrets 页面。
2. 找到 **Actions／工作流通知**，开启 **Email**；如果界面提供“工作流完成时通知我”的选项，也开启它。
3. 想同时收到成功和失败的通知时，取消勾选 **Only notify for failed workflows／仅失败时通知**。
4. 确认 GitHub 的通知邮箱正确、已验证；在手机邮箱 App 中开启推送。如果没有收到，检查垃圾邮件和通知过滤规则。
5. 用自己的账号手动 **Run workflow** 一次，检查是否能收到完成邮件。定时运行后的邮件也需要在首次 schedule 执行后确认；GitHub 的通知接收人会受工作流触发者、定时配置的修改者和个人设置影响。

邮件主要提示**工作流成功或失败**，具体“领取成功／已经领取／没有月卡”请点开运行 Summary。GitHub 邮件不是独立漏跑监测：任务没有启动、被暂停或未触发时，可能不会有任何完成邮件。

## 把通知发到个人邮箱，保留教育邮箱

如果不想让工作流通知进入教育邮箱，可以添加个人邮箱并修改默认通知收件地址：

1. 打开 [GitHub 邮箱设置](https://github.com/settings/emails)，在 **Add email address** 中添加个人邮箱。
2. 去个人邮箱查收验证邮件，点击验证链接。
3. 回到 [GitHub 通知设置](https://github.com/settings/notifications)，找到 **Default notifications email／默认通知邮箱**，选择已验证的个人邮箱并保存。
4. 在手机个人邮箱 App 中开启推送。通过一次 Run workflow 或 cron-job.org Test run，确认完成邮件实际送到个人邮箱。

教育邮箱可以保留，**不必更改 Primary email，也不必更改 Git 提交邮箱**。此设置改变的是默认通知收件地址，会影响使用默认地址的其他 GitHub 通知，不只是雀魂仓库。

**Custom routing 主要按组织配置，不能用它给这个个人账号下的仓库单独选择通知邮箱。** 不需要为了接收通知创建组织，也不要把个人邮箱或邮箱密码填进雀魂账号 Secrets。

## GitHub 与 cron-job.org 通知的区别

| 来源 | 主要监测内容 |
|---|---|
| GitHub Actions 邮件 | 工作流执行成功或失败；具体领取结果查看 Summary |
| cron-job.org 通知 | 请求 GitHub 是否成功、任务失败／恢复或被禁用等；取决于服务中的通知设置 |

cron-job.org 返回 HTTP 204 后，即使 GitHub 后续登录或领取失败，外部服务也可能认为触发成功。它的成功通知通常指故障后的恢复，不等于每日领取报告。因此建议保留 GitHub Actions 邮件，并将默认收件地址改为个人邮箱；外部服务的失败通知可作为补充。


[返回首页](../README.md)
