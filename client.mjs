import https from 'node:https';
import { readFileSync } from 'node:fs';
import { createHmac, randomUUID } from 'node:crypto';
import protobuf from 'protobufjs';
import WebSocket from 'ws';
import { HttpsProxyAgent } from 'https-proxy-agent';

const base = 'https://game.maj-soul.com/1/';
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const agent = proxy ? new HttpsProxyAgent(proxy) : undefined;
const allowedMethods = new Set(['Route.requestConnection', 'Lobby.fetchServerTime', 'Lobby.login', 'Lobby.fetchMonthTicketInfo', 'Lobby.payMonthTicket']);
export function trustedUrl(value) {
  const url = new URL(value);
  if (!['https:', 'wss:'].includes(url.protocol) || !/(^|\.)maj-soul\.com$/.test(url.hostname) || url.username || url.password) throw new Error('UNTRUSTED_ENDPOINT');
  return url;
}
async function getJson(value) {
  const url = trustedUrl(value);
  return new Promise((resolve, reject) => {
    const request = https.get(url, {agent, headers: {'User-Agent': 'majsoul-month-ticket/2.0'}}, response => {
      if (response.statusCode !== 200) {response.resume(); reject(new Error('HTTP_STATUS')); return;}
      let size = 0;
      const chunks = [];
      response.on('data', data => {
        size += data.length;
        if (size > 16 * 1024 * 1024) request.destroy(new Error('HTTP_SIZE'));
        else chunks.push(data);
      });
      response.on('error', () => reject(new Error('HTTP_RESPONSE')));
      response.on('end', () => {
        try {resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}
        catch {reject(new Error('HTTP_JSON'));}
      });
    });
    const timer = setTimeout(() => request.destroy(new Error('HTTP_TIMEOUT')), 15000);
    request.on('error', () => reject(new Error('HTTP_NETWORK')));
    request.on('close', () => clearTimeout(timer));
  });
}
export function encodeRequest(root, index, service, method, body) {
  const rpc = root.lookupService(`lq.${service}`).methods[method];
  if (!rpc) throw new Error('SCHEMA_METHOD');
  rpc.resolve();
  const request = rpc.resolvedRequestType;
  const wrapper = root.lookupType('lq.Wrapper');
  const payload = wrapper.encode({name: `.lq.${service}.${method}`, data: request.encode(request.fromObject(body)).finish()}).finish();
  const header = Buffer.from([2, index & 255, index >> 8]);
  return {frame: Buffer.concat([header, payload]), responseType: rpc.resolvedResponseType};
}
export class Client {
  constructor(root, socket) {
    this.root = root; this.socket = socket; this.pending = new Map(); this.index = 0;
    socket.on('message', data => this.receive(Buffer.from(data)));
    socket.on('error', () => this.fail('SOCKET_ERROR'));
    socket.on('close', () => this.fail('SOCKET_CLOSED'));
  }
  fail(code) {
    for (const {reject, timer} of this.pending.values()) {clearTimeout(timer); reject(new Error(code));}
    this.pending.clear();
  }
  receive(frame) {
    if (frame[0] !== 3 || frame.length < 3) return; // Notifications are deliberately ignored.
    const index = frame.readUInt16LE(1), pending = this.pending.get(index);
    if (!pending) return;
    clearTimeout(pending.timer); this.pending.delete(index);
    try {
      const wrapped = this.root.lookupType('lq.Wrapper').decode(frame.subarray(3));
      const decoded = pending.responseType.decode(wrapped.data);
      if (decoded.error?.code) pending.reject(new Error(`RPC_${pending.method}_${Number(decoded.error.code)}`));
      else pending.resolve(decoded);
    } catch {pending.reject(new Error('RPC_DECODE'));}
  }
  rpc(service, method, body = {}, timeout = 15000) {
    if (!allowedMethods.has(`${service}.${method}`)) return Promise.reject(new Error('RPC_NOT_ALLOWED'));
    if (this.socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error('SOCKET_NOT_OPEN'));
    const index = ++this.index;
    const {frame, responseType} = encodeRequest(this.root, index, service, method, body);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {this.pending.delete(index); reject(new Error(`RPC_TIMEOUT_${method}`));}, timeout);
      this.pending.set(index, {resolve, reject, timer, responseType, method});
      this.socket.send(frame, error => {
        if (error) {clearTimeout(timer); this.pending.delete(index); reject(new Error('SOCKET_SEND'));}
      });
    });
  }
  close() {this.fail('SOCKET_CLOSED'); this.socket.terminate();}
}
async function openSocket(url) {
  trustedUrl(url);
  const socket = new WebSocket(url, {agent, origin: 'https://game.maj-soul.com', handshakeTimeout: 10000, maxPayload: 4 * 1024 * 1024});
  // Always install an error listener, including after the connection promise settles.
  socket.on('error', () => {});
  await new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', () => {socket.terminate(); reject(new Error('SOCKET_CONNECT'));});
    socket.once('close', () => reject(new Error('SOCKET_CONNECT')));
  });
  return socket;
}
export function updateUnitySchema(root) {
  const connectionType = root.lookupType('lq.ReqRequestConnection');
  if (!connectionType.fields.platform) connectionType.add(new protobuf.Field('platform', 6, 'string'));
}
export async function connect(log = console.log) {
  log('步骤 1/4：读取官方版本、协议与服务器配置。');
  const versionInfo = await getJson(`${base}version.json`);
  const version = versionInfo.version;
  if (!/^\d+\.\d+\.\d+\.w$/.test(version)) throw new Error('VERSION_FORMAT');
  const manifest = await getJson(`${base}resversion${version}.json`);
  const resource = async path => {
    const prefix = manifest.res?.[path]?.prefix;
    if (!/^v\d+\.\d+\.\d+\.w$/.test(prefix || '')) throw new Error('RESOURCE_VERSION');
    return getJson(`${base}${prefix}/${path}`);
  };
  const [schema, config] = await Promise.all([resource('res/proto/liqi.json'), resource('config.json')]);
  const root = protobuf.Root.fromJSON(schema);
  // Unity cli_route_pb adds the platform field missing from the legacy manifest.
  updateUnitySchema(root);
  root.resolveAll();
  const gateways = config.ip?.find(item => item.name === 'player')?.gateways;
  if (!gateways?.length) throw new Error('GATEWAY_CONFIG');
  log('步骤 2/4：获取线路并进行连接握手（不登录账号）。');
  let routes;
  // Try several official gateways; only network setup may retry, never password login.
  for (const gateway of gateways.slice(0, 4)) {
    try {
      const url = new URL('/api/clientgate/routes', trustedUrl(gateway.url));
      url.search = new URLSearchParams({platform: 'Web', version, lang: 'chst'}).toString();
      const response = await getJson(url);
      if (response.data?.maintenance?.length) throw new Error('SERVER_MAINTENANCE');
      routes = response.data?.routes;
      if (routes?.length) break;
    } catch (error) {
      if (error.message === 'SERVER_MAINTENANCE') throw error;
      log('该网关暂不可达，尝试下一条官方线路。');
    }
  }
  if (!routes?.length) throw new Error('GATEWAY_UNREACHABLE');
  for (const route of routes.filter(r => r.ssl && ['idle', 'normal'].includes(r.state)).slice(0, 4)) {
    let client;
    try {
      client = new Client(root, await openSocket(`wss://${route.domain}/gateway`));
      const response = await client.rpc('Route', 'requestConnection', {type: 1, route_id: route.id, timestamp: Date.now(), platform: 'Web'});
      if (response.result !== 1) throw new Error('ROUTE_REJECTED');
      return {client, version};
    } catch (error) {client?.close(); const code = /^[A-Za-z0-9_]+$/.test(error.message) ? error.message : 'PROTOCOL_ERROR'; log(`该线路握手未成功（${code}），尝试下一条官方线路。`);}
  }
  throw new Error('ROUTE_UNREACHABLE');
}
export function currentLoginVersion() {
  const value = JSON.parse(readFileSync(new URL('./client-version.json', import.meta.url), 'utf8'));
  if (!/^\d+\.\d+\.\d+$/.test(value.resource) || !/^\d+\.\d+\.\d+$/.test(value.package) || value.platform !== 'WebGL') throw new Error('LOGIN_VERSION_CONFIG');
  return value;
}
export function loginBody(email, password, version) {
  return {account: email, password: createHmac('sha256', 'lailai').update(password).digest('hex'), reconnect: false,
    device: {platform: 'pc', hardware: 'pc', os: 'linux', os_version: 'ubuntu-24.04', is_browser: true, software: 'Chrome', sale_platform: 'web'},
    random_key: randomUUID(), client_version: {resource: version.resource, package: version.package}, gen_access_token: false,
    currency_platforms: [], type: 0, client_version_string: `WebGL_2022-${version.resource}`, tag: 'cn'};
}
