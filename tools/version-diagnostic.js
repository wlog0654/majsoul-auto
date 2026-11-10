// Run in the official game's browser console BEFORE pressing its login button.
// Only prints version metadata. Account, password and tokens are skipped, not printed.
(() => {
  if (window.__majsoulVersionRestore) {console.info('版本诊断已开启。'); return;}
  const original = WebSocket.prototype.send;
  const decodeText = bytes => new TextDecoder().decode(bytes);
  function fields(bytes) {
    const out = new Map(); let pos = 0;
    const integer = () => {let value = 0, shift = 0; while (pos < bytes.length && shift < 49) {const b = bytes[pos++]; value += (b & 127) * 2 ** shift; if (!(b & 128)) return value; shift += 7;} throw Error('invalid');};
    while (pos < bytes.length) {
      const tag = integer(), number = Math.floor(tag / 8), wire = tag & 7;
      if (wire === 2) {const size = integer(), end = pos + size; if (end > bytes.length) throw Error('invalid'); out.set(number, bytes.subarray(pos, end)); pos = end;}
      else if (wire === 0) integer();
      else if (wire === 1) pos += 8;
      else if (wire === 5) pos += 4;
      else throw Error('invalid');
    }
    return out;
  }
  WebSocket.prototype.send = function(data) {
    try {
      const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : null;
      if (bytes?.[0] === 2) {
        const wrapper = fields(bytes.subarray(3));
        if (decodeText(wrapper.get(1) || new Uint8Array()) === '.lq.Lobby.login') {
          const request = fields(wrapper.get(2));
          const version = fields(request.get(6) || new Uint8Array());
          console.info('雀魂登录版本（仅版本信息）：', JSON.stringify({resource:decodeText(version.get(1)||new Uint8Array()), package:decodeText(version.get(2)||new Uint8Array()), client_version_string:decodeText(request.get(11)||new Uint8Array())}));
          window.__majsoulVersionRestore();
        }
      }
    } catch { /* Diagnostics must never interrupt the official client. */ }
    return original.apply(this, arguments);
  };
  window.__majsoulVersionRestore = () => {WebSocket.prototype.send = original; delete window.__majsoulVersionRestore;};
  console.info('版本诊断已开启。请正常登录；只会输出三个版本字段，之后自动关闭。刷新网页也会关闭。');
})();
