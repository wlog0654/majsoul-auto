# 雀魂月卡自动领取

在 GitHub Actions 云端运行，你的电脑可以关机。针对 https://game.maj-soul.com/1/ 的邮箱密码登录。

**当前状态：真实账号登录和已领取状态查询已通过；新增自动读取官方版本。每日定时仍由 MAJSOUL_AUTO_ENABLED 控制。**

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

- 读取官网发布的协议、版本和线路配置，通过 TLS WebSocket 连接服务；不再加载游戏页面，也不安装浏览器。
- 查询月卡；过期或没有月卡时结束；本游戏日已领取时跳过。
- 可领取时调用官方客户端使用的 `payMonthTicket`（这是每日奖励领取接口），随后重新查询以核验领取时间。
- 不购买月卡，不充值，不进行对局。
- 遇到验证码、登录限制、接口更新、网络故障时失败退出，不绕过验证、不自动重复尝试登录。
- 不保存浏览器登录状态，不上传截图、浏览器控制台日志或响应内容；运行日志仅含固定状态和错误码。
- 同仓库的任务串行运行，避免手动与定时任务同时领取。

## 排错

- `MISSING_SECRETS`：检查两个 Repository Secrets 的名称和值。
- `RPC_login_数字`：服务器拒绝登录。请先在官网手动登录检查密码、账号验证或限制。
- `GATEWAY_UNREACHABLE` / `ROUTE_UNREACHABLE`：线路网络或握手失败。`RPC_login_数字` 代表服务器拒绝登录；协议或版本更新也可能需要适配。
- `CLAIM_NOT_VERIFIED`：领取后未能核验，先到游戏查看，避免立即反复重跑。
- 任务显示 Skipped：检查 Repository Variable `MAJSOUL_AUTO_ENABLED` 是否为小写 `true`。

仓库当前为公开仓库：代码和 Actions 日志可能公开，但 GitHub Secrets 的值不写入仓库。不要把账号密码提交到文件、Issue 或截图中。如果希望隐藏运行记录，可将仓库改为私有；私有仓库受账号 Actions 额度限制。公开仓库长期没有活动时，GitHub 可能暂停定时工作流（通常为 60 天），届时需重新启用。

## 本地开发

Node.js 22：`npm ci`、`npm test`。`node claim.mjs --check-connection` 可在不提供账号、不登录、不领取的情况下验证服务器连接。用环境变量提供账号后运行 `npm start`。这会进行真实领取，不是模拟运行。

11 项测试覆盖消息编解码、响应匹配、错误和超时处理、接口限制，以及游戏日边界与重复领取。云端已通过实际线路握手测试；这些检查不能替代真实账号验收。

## Unity 登录版本适配

`151` 的官方含义为“游戏版本过旧”，不代表密码错误。当前已按新版官方代码适配：`client_version.resource=0.16.290`、`client_version.package=4.0.51`、`client_version_string=WebGL_2022-0.16.290`。网页显示的 `.W` 是平台标记，不加入 resource 字段。

GitHub Actions 每次先执行 `tools/resolve_version.py`：从官网页面读取程序包版本，从当前官方资源索引定位 `docs_version/version.json` 所在的 bundle，解析其中的资源版本，生成 `work/current-client-version.json`。登录步骤通过 `MAJSOUL_VERSION_FILE` 使用这份实时结果。无需为了普通版本号更新手动修改仓库或新增 Secrets。

读取失败、出现多个冲突版本、官方资源路径或格式改变时，本次直接失败，不使用旧配置继续登录，也不自动重试密码。`client-version.json` 仅作为本地开发的手动版本配置；GitHub 工作流不会回退到它。

自动跟随的是版本数据，不能自动修改登录协议、编写或执行官方下发的游戏代码。若协议、加密、握手方式或奖励接口改变，仍需人工维护。失败会出现在 Actions；如需邮件通知，请在 GitHub 个人 Settings → Notifications → Actions 中启用失败通知。

线路握手已补齐 Unity 协议字段 `ReqRequestConnection.platform`（字段号 6，字符串 `Web`）。仅修改登录版本不足以兼容新版服务。无账号密码的诊断请求补齐该字段后，返回值从 `151` 变为 `1002`；之后已由用户在 GitHub Actions 实测确认真实账号登录及已领取状态查询成功。

版本解析需要 Python 和 `requirements-version.txt` 中的 UnityPy；4 项 Python 测试另行运行。用于解析少量官方资源，不安装浏览器、不下载和启动完整游戏。
