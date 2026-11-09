import { chromium } from 'playwright';
import { appendFile } from 'node:fs/promises';
import { ticketStatus } from './status.mjs';

const email = process.env.MAJSOUL_EMAIL;
const password = process.env.MAJSOUL_PASSWORD;
// Never forward browser console messages, RPC bodies, screenshots, or browser storage to logs.
async function summary(message) {
  console.log(message);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${message}\n`);
}
let browser;
try {
  if (!email || !password) throw new Error('MISSING_SECRETS');
  browser = await chromium.launch({headless: true});
  const context = await browser.newContext({viewport: {width: 1280, height: 720}});
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  await page.goto('https://game.maj-soul.com/1/', {waitUntil: 'domcontentloaded', timeout: 60000});
  console.log('正在加载官方客户端，最多等待 6 分钟。');
  await page.waitForFunction(() =>
    typeof GameMgr !== 'undefined' && GameMgr.Inst &&
    typeof uiscript !== 'undefined' && uiscript.UI_Entrance?.Inst &&
    typeof net !== 'undefined' && net.NetRouteGroup_Entrance?.Inst &&
    typeof game !== 'undefined' && game.ResourceVersion?.version,
    null, {timeout: 360000});

  const result = await page.evaluate(async ({email, password}) => {
    const deadline = (promise, ms, code) => new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(code)), ms);
      promise.then(v => {clearTimeout(t); resolve(v);}, e => {clearTimeout(t); reject(e);});
    });
    await deadline(new Promise((resolve, reject) => {
      uiscript.UI_Entrance.ensureNetwork(resolve, () => reject(new Error('NETWORK_CONNECT_FAILED')));
    }), 60000, 'NETWORK_TIMEOUT');
    const rpc = (method, body) => deadline(new Promise((resolve, reject) => {
      app.NetAgent.sendReq2Lobby('Lobby', method, body, (err, response) => {
        if (err) return reject(new Error(`RPC_TRANSPORT_${method}`));
        if (!response) return reject(new Error(`RPC_EMPTY_${method}`));
        if (response.error?.code) return reject(new Error(`RPC_${method}_${Number(response.error.code)}`));
        resolve(response);
      });
    }), 45000, `RPC_TIMEOUT_${method}`);
    const login = await rpc('login', {
      account: email, password: GameMgr.encodeP(password), reconnect: false,
      device: GameMgr.Inst.get_device_info(), random_key: GameMgr.device_id,
      client_version: {resource: game.ResourceVersion.version}, gen_access_token: false,
      currency_platforms: game.Tools.get_platform_currency(), type: 0,
      client_version_string: GameMgr.Inst.getClientVersion(), tag: GameMgr.Inst.getReportClientType()
    });
    if (!login.account_id) throw new Error('LOGIN_NOT_CONFIRMED');
    if (Number(login.account?.frozen_state || 0) !== 0) throw new Error('LOGIN_ACCOUNT_RESTRICTED');
    // Only these two reward methods are exposed to the second stage; no purchase or game actions.
    window.__monthTicketRPC = rpc;
    const response = await rpc('fetchMonthTicketInfo', {});
    const info = response.month_ticket_info;
    const now = Number(game.Tools.getServerTime(true));
    if (!Number.isFinite(now)) throw new Error('INVALID_SERVER_TIME');
    return {now, info: info ? {end_time: Number(info.end_time), last_pay_time: Number(info.last_pay_time || 0)} : null};
  }, {email, password});

  const status = ticketStatus(result.info, result.now);
  if (status === 'inactive') {
    await summary('未发现有效月卡，未领取、未购买。');
  } else if (status === 'already_claimed') {
    await summary('本游戏日的月卡奖励已领取，无需重复领取。');
  } else {
    const after = await page.evaluate(async () => {
      const reward = await window.__monthTicketRPC('payMonthTicket', {});
      const state = await window.__monthTicketRPC('fetchMonthTicketInfo', {});
      return {
        info: state.month_ticket_info ? {
          end_time: Number(state.month_ticket_info.end_time),
          last_pay_time: Number(state.month_ticket_info.last_pay_time || 0)
        } : null,
        now: Number(game.Tools.getServerTime(true)),
        count: Number(reward.resource_count || 0)
      };
    });
    if (ticketStatus(after.info, after.now) !== 'already_claimed' || after.info.last_pay_time <= (result.info.last_pay_time || 0)) {
      throw new Error('CLAIM_NOT_VERIFIED');
    }
    await summary(`月卡奖励领取成功，服务器已确认今日领取状态。奖励数量：${after.count}。`);
  }
} catch (error) {
  const message = String(error?.message || 'UNKNOWN');
  // Allow only our fixed error codes through; Playwright errors can include page content.
  const code =  /\b(MISSING_SECRETS|INVALID_TICKET_TIME|INVALID_SERVER_TIME|LOGIN_NOT_CONFIRMED|LOGIN_ACCOUNT_RESTRICTED|CLAIM_NOT_VERIFIED|NETWORK_CONNECT_FAILED|NETWORK_TIMEOUT|RPC_[A-Za-z0-9_]+)\b/.exec(message)?.[0] || 'BROWSER_OR_CLIENT_ERROR';
  await summary(`领取未完成：${code}。请检查 Secrets、登录验证或客户端更新。`);
  process.exitCode = 1;
} finally {
  await browser?.close();
}
