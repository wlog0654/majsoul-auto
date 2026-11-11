# 账号准备与手动测试（A、B 共用）

先完成这 4 步，再回到你选择的方案。**这里只准备账号和验证领取，不会开启每日定时。**

## 1. Fork

点击原仓库右上角 **Fork → Create fork**。后续都在 `github.com/你的用户名/majsoul-auto` 操作。

## 2. 启用 Actions

进入自己的 Fork → **Actions**，按提示启用工作流。再选择左侧 **雀魂月卡奖励**；如果显示禁用，点 **Enable workflow**。

## 3. 填写雀魂邮箱和密码

进入 **Settings → Secrets and variables → Actions → Secrets → New repository secret**，分别新增：

| Name | Secret |
|---|---|
| `MAJSOUL_EMAIL` | 雀魂登录邮箱 |
| `MAJSOUL_PASSWORD` | 雀魂登录密码 |

使用 **Repository secrets**，不需要 Environment。不要给值额外加引号或空格。仅适配 [game.maj-soul.com/1/](https://game.maj-soul.com/1/) 的邮箱＋密码登录。

**不要把密码写进文件、聊天、Issue 或截图。** Fork 不会继承他人的凭据；有仓库写权限的人能修改工作流使用你的 Secrets，请谨慎授权。

## 4. 手动测试

**Actions → 雀魂月卡奖励 → Run workflow → 分支 main → Run workflow**。

查看这次运行的 Summary：

| 结果 | 含义 |
|---|---|
| 领取成功，服务器已确认 | 本次完成领取及核验 |
| 本游戏日已领取 | 登录和查询成功，今天无需再领 |
| 未发现有效月卡 | 不会购买或续费 |
| 领取未完成 | 先按错误码排查，不要开启定时 |

绿色也可能只是“今天已领”或“没有月卡”，不代表一定发了新奖励。进入游戏主界面也可能自动领取。

改过代码后请**新建 Run workflow**，不要重跑旧记录，旧记录会继续使用旧代码。

**准备完成，继续你选的方案：**

- **[A：外部定时（推荐）](EXTERNAL-SCHEDULER.md#1-完成账号准备)**
- **[B：GitHub 原生定时](NATIVE-SCHEDULER.md#2-开启原生定时开关)**
