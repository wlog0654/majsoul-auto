import { appendFile } from 'node:fs/promises';
import { connect, loginBody, currentLoginVersion } from './client.mjs';
import { ticketStatus } from './status.mjs';
async function report(message) {
  console.log(message);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${message}\n`);
}
let client;
try {
  const checkOnly = process.argv.includes('--check-connection');
  const email = process.env.MAJSOUL_EMAIL, password = process.env.MAJSOUL_PASSWORD;
  if (!checkOnly && (!email || !password)) throw new Error('MISSING_SECRETS');
  const connection = await connect();
  client = connection.client;
  if (checkOnly) {
    await report('连接检查通过：已完成官方线路握手；未登录、未领取。');
  } else {
    console.log('步骤 3/4：登录账号并查询月卡（只尝试一次登录）。');
    const version = currentLoginVersion();
    console.log(`登录版本：资源 ${version.resource}，程序包 ${version.package}，WebGL_2022-${version.resource}。`);
    const login = await client.rpc('Lobby', 'login', loginBody(email, password, version));
    if (!login.account_id) throw new Error('LOGIN_NOT_CONFIRMED');
    if (Number(login.account?.frozen_state || 0) !== 0) throw new Error('LOGIN_ACCOUNT_RESTRICTED');
    let response = await client.rpc('Lobby', 'fetchMonthTicketInfo');
    const time = await client.rpc('Lobby', 'fetchServerTime');
    const before = response.month_ticket_info;
    const status = ticketStatus(before, Number(time.server_time));
    if (status === 'inactive') await report('未发现有效月卡，未领取、未购买。');
    else if (status === 'already_claimed') await report('本游戏日的月卡奖励已领取，无需重复领取。');
    else {
      console.log('步骤 4/4：领取每日奖励并查询服务器状态核验。');
      const reward = await client.rpc('Lobby', 'payMonthTicket');
      response = await client.rpc('Lobby', 'fetchMonthTicketInfo');
      const after = response.month_ticket_info;
      const afterTime = await client.rpc('Lobby', 'fetchServerTime');
      if (ticketStatus(after, Number(afterTime.server_time)) !== 'already_claimed' || Number(after.last_pay_time) <= Number(before.last_pay_time || 0)) throw new Error('CLAIM_NOT_VERIFIED');
      await report(`月卡奖励领取成功，服务器已确认今日领取状态。奖励数量：${Number(reward.resource_count || 0)}。`);
    }
  }
} catch (error) {
  // Log only our fixed error codes; never log request/response bodies or credentials.
  const message = String(error?.message || '');
  const code = /^[A-Z][A-Za-z0-9_]{1,80}$/.test(message) ? message : 'CLIENT_ERROR';
  const detail = code === 'RPC_login_151' ? '服务器要求更新客户端版本；请更新仓库的 client-version.json 并核对登录协议，勿重复尝试密码。' : '请检查网络、Secrets、账号验证或协议兼容性。';
  await report(`领取未完成：${code}。${detail}`);
  process.exitCode = 1;
} finally {client?.close();}
