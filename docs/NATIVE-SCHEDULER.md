# B：GitHub 原生定时

> **此方案可能延迟或漏跑。任务没触发时，也可能没有邮件。**
> 不想依赖原生调度？改用 **[A：外部定时（推荐）](EXTERNAL-SCHEDULER.md)**。只配置一种日常触发方式即可。

## 1. 完成账号准备

先按 **[账号准备与手动测试](SETUP.md)** 完成 Fork、启用 Actions、添加邮箱密码并手动测试成功。

## 2. 开启原生定时开关

自己仓库 → **Settings → Secrets and variables → Actions → Variables → New repository variable**：

| Name | Value |
|---|---|
| `MAJSOUL_AUTO_ENABLED` | `true` |

是 **Variables**，不是 Secrets；`true` 小写、不加引号。

每天北京时间 **09:30、15:30** 尝试执行。第二次已领取就跳过。

## 3. 开启邮件并验证

按 **[邮件通知教程](NOTIFICATIONS.md)** 配置。下一个完整时段过后，检查 Actions 是否出现触发来源为 **schedule** 的记录。手动测试成功不代表定时一定正常。

没有新记录时：[调度排查](SCHEDULING.md)，或改用 [A 方案](EXTERNAL-SCHEDULER.md)。

## 暂停

将变量改为 `false`。若准备切换 A，**保持 GitHub 工作流启用**，只暂停原生定时领取。

[返回方案选择](../README.md#第一步选一种方案只跟对应教程操作)
