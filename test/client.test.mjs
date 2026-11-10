import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import protobuf from 'protobufjs';
import { Client, trustedUrl, encodeRequest, loginBody, currentLoginVersion, updateUnitySchema } from '../client.mjs';
const root = protobuf.parse(`syntax="proto3"; package lq;
message Wrapper {string name=1; bytes data=2;}
message Error {uint32 code=1;}
message Req {uint32 type=2; string route_id=3; uint64 timestamp=4;}
message Res {Error error=1; uint64 timestamp=2; uint32 result=3;}
service Route {rpc requestConnection(Req) returns (Res);}`, {keepCase: true}).root;
class Socket extends EventEmitter {
  readyState = 1;
  send(frame, callback) {this.frame = frame; callback?.();}
  terminate() {this.readyState = 3; this.emit('close');}
}
function response(index, body) {
  const payload = root.lookupType('lq.Wrapper').encode({name:'', data:root.lookupType('lq.Res').encode(body).finish()}).finish();
  return Buffer.concat([Buffer.from([3, index & 255, index >> 8]), payload]);
}
test('trusted endpoint excludes credentials and lookalike domains', () => {
  assert.equal(trustedUrl('wss://route-4.maj-soul.com/gateway').protocol, 'wss:');
  for (const url of ['https://maj-soul.com.evil.test/', 'http://route-4.maj-soul.com/', 'https://secret@game.maj-soul.com/']) assert.throws(() => trustedUrl(url));
});
test('wire request uses little endian request id and correct RPC name', () => {
  const {frame} = encodeRequest(root, 257, 'Route', 'requestConnection', {type:1, route_id:'route-4', timestamp:100});
  assert.equal(frame[0], 2); assert.equal(frame.readUInt16LE(1), 257);
  const wrapper = root.lookupType('lq.Wrapper').decode(frame.subarray(3));
  assert.equal(wrapper.name, '.lq.Route.requestConnection');
  assert.equal(root.lookupType('lq.Req').decode(wrapper.data).route_id, 'route-4');
});
test('response matched by id; notification does not resolve RPC', async () => {
  const socket = new Socket(), client = new Client(root, socket);
  const promise = client.rpc('Route','requestConnection');
  socket.emit('message', Buffer.from([1,0,0]));
  assert.equal(client.pending.size, 1);
  socket.emit('message', response(1,{result:1}));
  assert.equal((await promise).result,1); client.close();
});
test('server errors reject instead of reporting success', async () => {
  const socket = new Socket(), client = new Client(root, socket);
  const promise = client.rpc('Route','requestConnection');
  socket.emit('message',response(1,{error:{code:503}}));
  await assert.rejects(promise,/RPC_requestConnection_503/); client.close();
});
test('timeout and close reject waiting requests; purchases are blocked', async () => {
  const socket = new Socket(), client = new Client(root, socket);
  await assert.rejects(client.rpc('Lobby','createOrder'),/RPC_NOT_ALLOWED/);
  await assert.rejects(client.rpc('Route','requestConnection',{},10),/RPC_TIMEOUT/);
  const promise = client.rpc('Route','requestConnection'); client.close();
  await assert.rejects(promise,/SOCKET_CLOSED/); assert.equal(client.pending.size,0);
});

test('Unity login sends resource, package and current platform version format', () => {
  const version = currentLoginVersion();
  const request = loginBody('test@example.invalid', 'example-password', version);
  assert.deepEqual(request.client_version, {resource: '0.16.290', package: '4.0.51'});
  assert.equal(request.client_version_string, 'WebGL_2022-0.16.290');
  assert.equal(request.password.length, 64);
  assert.notEqual(request.password, 'example-password');
});

test('Unity handshake platform survives encoding against the legacy schema', () => {
  const legacy = protobuf.parse('syntax="proto3";package lq;message ReqRequestConnection {uint32 type=2;string route_id=3;uint64 timestamp=4;}').root;
  updateUnitySchema(legacy);
  updateUnitySchema(legacy);
  const type = legacy.lookupType('lq.ReqRequestConnection');
  const message = type.decode(type.encode(type.fromObject({type:1,platform:'Web'})).finish());
  assert.equal(message.platform,'Web');
  assert.equal(type.fields.platform.id,6);
});
