# 雀魂月卡自动领取

在 GitHub Actions 云端运行，你的电脑可以关机。针对 https://game.maj-soul.com/1/ 的邮箱密码登录。

**当前状态：代码已准备，未验证真实账号登录／领取成功。定时运行须手动启用。**

## 配置（只需一次）

1. 打开本仓库 **Settings → Secrets and variables → Actions → Secrets → New repository secret**，添加：
   - `MAJSOUL_EMAIL`：雀魂登录邮箱。
   - `MAJSOUL_PASSWORD`：雀魂登录密码。
   Codex 个人保险库中的值不会自动同步到 GitHub，请在 GitHub 单独添加。
2. 进入 **Actions → 雀魂月卡奖励 → Run workflow → Run workflow**，进行首次实际领取测试。
3. 查看该次运行的 Summary。只有出现“月卡奖励领取成功”或“本游戏日的月卡奖励已领取”才表示账号流程正常；无有效月卡时不会购买。
4. 首次测试通过后，在 **Settings → Secrets and variables → Actions → Variables → New repository variable** 添加 `MAJSOUL_AUTO_ENABLED`，值填 `true`。

启用后每天北京时间 **09:00**（UTC 01:00）运行。GitHub 调度可能延迟，偶尔可能不运行，不保证准点。

暂停：将 `MAJSOUL_AUTO_ENABLED` 改为 `false`，或在 Actions 中 Disable workflow。手动 Run workflow 始终会进行一次真实领取尝试。

## 行为

- 用 Playwright 加载官方客户端，使用客户端当前版本的登录请求和连接逻辑。
- 查询月卡；过期或没有月卡时结束；本游戏日已领取时跳过。
- 可领取时调用官方客户端使用的 `payMonthTicket`（这是每日奖励领取接口），随后重新查询以核验领取时间。
- 不购买月卡，不充值，不进行对局。
- 遇到验证码、登录限制、接口更新、网络故障时失败退出，不绕过验证、不自动重复尝试登录。
- 不保存浏览器登录状态，不上传截图、浏览器控制台日志或响应内容；运行日志仅含固定状态和错误码。
- 同仓库的任务串行运行，避免手动与定时任务同时领取。

## 排错

- `MISSING_SECRETS`：检查两个 Repository Secrets 的名称和值。
- `RPC_login_数字`：服务器拒绝登录。请先在官网手动登录检查密码、账号验证或限制。
- `BROWSER_OR_CLIENT_ERROR`：官网资源加载失败、超时或客户端代码更新，需要检查脚本兼容性。
- `CLAIM_NOT_VERIFIED`：领取后未能核验，先到游戏查看，避免立即反复重跑。
- 任务显示 Skipped：检查 Repository Variable `MAJSOUL_AUTO_ENABLED` 是否为小写 `true`。

仓库当前为公开仓库：代码和 Actions 日志可能公开，但 GitHub Secrets 的值不写入仓库。不要把账号密码提交到文件、Issue 或截图中。如果希望隐藏运行记录，可将仓库改为私有；私有仓库受账号 Actions 额度限制。公开仓库长期没有活动时，GitHub 可能暂停定时工作流（通常为 60 天），届时需重新启用。

## 本地开发

Node.js 22：`npm ci`，`npx playwright install chromium`，`npm test`。用环境变量提供账号后运行 `npm start`。这会进行真实领取，不是模拟运行。

单元测试只覆盖游戏日边界、重复领取、无月卡和异常时间；不能替代真实账号验收。
