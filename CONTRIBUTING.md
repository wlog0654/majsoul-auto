# 开发与维护

目前目标为 `https://game.maj-soul.com/1/` 的邮箱＋密码登录，不默认宣称支持其他区服或登录方式。

## 本地检查

需要 Node.js 22、Python 3.12，以及连接官方资源所需的网络权限。

```sh
npm ci --ignore-scripts
npm test
python3 -m venv .version-venv
.version-venv/bin/python -m pip install -r requirements-version.txt
.version-venv/bin/python -m unittest discover -s test -p 'test_*.py'
.version-venv/bin/python tools/resolve_version.py work/current-client-version.json
node claim.mjs --check-connection
```

最后一条命令只检查线路连接，不登录、不领取。当前 11 项 Node 测试和 4 项 Python 测试不能代替真实账号验收。

如需实际登录测试，先通过本地安全方式设置 `MAJSOUL_EMAIL`、`MAJSOUL_PASSWORD` 和 `MAJSOUL_VERSION_FILE=work/current-client-version.json`，再执行 `npm start`。这会进行真实操作。不要把密码写进命令历史、源码或测试数据。

## 关键文件

| 文件 | 用途 |
|---|---|
| `.github/workflows/claim.yml` | 手动／定时触发，安装依赖，解析版本并执行任务 |
| `tools/resolve_version.py` | 从官方网页和当前 Unity 资源索引读取登录版本 |
| `client.mjs` | TLS WebSocket 连接、受限 RPC、握手兼容与登录参数 |
| `claim.mjs` | 登录、查询月卡、领取与领取后核验 |
| `status.mjs` | 月卡有效期和游戏日判断 |
| `client-version.json` | 本地开发用的手动版本配置；GitHub 定时任务使用实时解析文件 |

## 修改要求

- 新增协议字段应依据当前官方客户端或实际请求，记录证据并测试编码结果，避免字段被旧 schema 丢弃。
- 不自动重复密码登录，不绕过验证码或账号限制。
- 保持 RPC 方法限制，不新增购买、充值或对局操作。
- 不输出账号、密码哈希、令牌、完整登录响应或原始网络帧。
- 领取后查询服务器确认状态，无法确认时失败退出。
- 不将成功的“已领取”查询描述为已经完成“未领取到领取”的真实验收。
- 新区服或新登录方式需独立验证和文档说明，不能仅改域名即宣称支持。

提交 PR 请说明问题、行为变化和验证方式。普通贡献者无需提供真实账号凭据。
