/** A bounded reader. Never maps executable pages or follows host-file references. */
export class BinaryError extends Error {
  constructor(message, offset = 0, code = 'JB6001') { super(message); this.offset = offset; this.code = code; }
}
export class Bytes {
  constructor(input) {
    this.data = input instanceof Uint8Array ? input : new Uint8Array(input);
    this.view = new DataView(this.data.buffer, this.data.byteOffset, this.data.byteLength);
    this.length = this.data.length;
  }
  check(at, length) { if (!Number.isSafeInteger(at) || !Number.isSafeInteger(length) || at < 0 || length < 0 || at + length > this.length) throw new BinaryError('Truncated or invalid binary range', at); }
  u8(at) { this.check(at, 1); return this.view.getUint8(at); }
  u16(at) { this.check(at, 2); return this.view.getUint16(at, true); }
  u32(at) { this.check(at, 4); return this.view.getUint32(at, true); }
  slice(at, length) { this.check(at, length); return this.data.subarray(at, at + length); }
  compressed(at) {
    const a = this.u8(at);
    if (!(a & 128)) return [a, at + 1];
    if ((a & 192) === 128) return [((a & 63) << 8) | this.u8(at + 1), at + 2];
    if ((a & 224) === 192) return [(a & 31) * 16777216 + this.u8(at + 1) * 65536 + this.u8(at + 2) * 256 + this.u8(at + 3), at + 4];
    throw new BinaryError('Invalid compressed metadata integer', at);
  }
  zero(at, max = this.length - at) {
    this.check(at, max); let end = at;
    while (end < at + max && this.data[end]) end++;
    if (end === at + max) throw new BinaryError('Unterminated metadata string', at);
    return new TextDecoder('utf-8', { fatal: true }).decode(this.slice(at, end - at));
  }
}
export function binaryDiagnostic(error, file = 'assembly.dll') {
  return {code: error.code || 'JB6001', severity: 'error', message: error.message, file, offset: error.offset || 0, line: 1, column: 1};
}
