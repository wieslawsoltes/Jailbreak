/** MSF 7.00 container. No native code, filesystem lookup, or trust decisions. */
import {Reader, BinaryError, bytesOf} from '../managed-pe/reader.js';
const magic = new TextEncoder().encode('Microsoft C/C++ MSF 7.00\r\n\x1aDS\0\0\0');
export const fail = (message, at = 0) => { throw new BinaryError(message, at, 'JB6510'); };
export const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
export function guid(bytes) {
  const b = Uint8Array.from(bytes);
  if (b.length !== 16) fail('Invalid native GUID');
  return [hex(b.slice(0,4).reverse()), hex(b.slice(4,6).reverse()), hex(b.slice(6,8).reverse()), hex(b.slice(8,10)), hex(b.slice(10))].join('-');
}
export function isNativePdb(input) {
  const bytes = bytesOf(input);
  return bytes.length >= magic.length && magic.every((value, i) => bytes[i] === value);
}
export function zeroAt(reader, at) {
  reader.check(at, 1);
  const end = reader.bytes.indexOf(0, at);
  if (end < at || end >= reader.end || end - at > 8192) fail('Unterminated or oversized native string', at);
  try { return new TextDecoder('utf-8', {fatal:true}).decode(reader.bytes.subarray(at, end)); }
  catch { fail('Invalid UTF-8 in native string table', at); }
}
export function readMsf(input, {maxBytes = 16*1024*1024, maxStreams = 65536} = {}) {
  const source = bytesOf(input);
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 56 || maxBytes > 256*1024*1024 || source.length > maxBytes) fail('MSF byte budget exceeded');
  if (!Number.isSafeInteger(maxStreams) || maxStreams < 4 || maxStreams > 1000000) fail('Invalid MSF stream budget');
  if (!isNativePdb(source)) fail('Not a Windows MSF7 PDB');
  // Snapshot the caller's memory. Every returned stream is an independent copy too.
  const bytes = new Uint8Array(source), r = new Reader(bytes); r.skip(32);
  const blockSize = r.u32(), freeMap = r.u32(), numBlocks = r.u32(), directorySize = r.u32(), reserved = r.u32(), blockMap = r.u32();
  if (![512,1024,2048,4096].includes(blockSize) || ![1,2].includes(freeMap) || reserved || numBlocks*blockSize !== bytes.length) fail('Invalid MSF superblock');
  if (numBlocks < 4 || directorySize < 4 || directorySize > maxBytes) fail('Invalid MSF directory size');
  const owned = new Set([0]);
  for (let i = 0; i < numBlocks; i += blockSize) for (const delta of [1,2]) if (i+delta < numBlocks) owned.add(i+delta);
  const claim = index => {
    if (!Number.isSafeInteger(index) || index >= numBlocks || index < 0) fail('MSF block index outside file');
    if (owned.has(index)) fail('MSF blocks are shared or reserved');
    owned.add(index); return index;
  };
  claim(blockMap);
  const directoryBlockCount = Math.ceil(directorySize/blockSize);
  if (directoryBlockCount*4 > blockSize) fail('MSF multi-page block map is outside the supported profile');
  const map = r.sub(blockMap*blockSize, directoryBlockCount*4), directoryBlocks = [];
  for (let i = 0; i < directoryBlockCount; i++) directoryBlocks.push(claim(map.u32()));
  function join(blocks, size) {
    const out = new Uint8Array(size);
    for (let i = 0; i < blocks.length; i++) out.set(bytes.subarray(blocks[i]*blockSize, blocks[i]*blockSize+Math.min(blockSize,size-i*blockSize)), i*blockSize);
    return new Reader(out);
  }
  const directory = join(directoryBlocks,directorySize), count = directory.u32();
  if (count < 4 || count > maxStreams) fail('MSF stream count exceeds budget');
  directory.check(directory.pos, count*4);
  const sizes = Array.from({length:count}, () => directory.u32()), streams = []; let total = 0;
  for (const size of sizes) {
    if (size === 0xffffffff) { streams.push(null); continue; }
    if ((total += size) > maxBytes) fail('MSF stream byte budget exceeded');
    const blocks = Array.from({length:Math.ceil(size/blockSize)}, () => claim(directory.u32()));
    streams.push(Object.freeze({size, blocks:Object.freeze(blocks)}));
  }
  if (directory.pos !== directory.end) fail('Unexpected MSF directory payload');
  return Object.freeze({blockSize, numBlocks, streams:Object.freeze(streams), read(index) {
    if (!Number.isSafeInteger(index) || !streams[index]) fail('Missing MSF stream '+index);
    return join(streams[index].blocks, streams[index].size);
  }});
}
/** PDB info stream's serialized name -> stream hash table. */
export function readNamedStreams(reader, msf) {
  const length = reader.u32(), strings = reader.sub(reader.pos, length); reader.skip(length);
  const size = reader.u32(), capacity = reader.u32();
  if (!capacity || capacity > 1000000 || size > capacity) fail('Invalid native named stream hash table');
  function bitVector() {
    const words = reader.u32();
    if (words > Math.ceil(capacity/32)) fail('Invalid native hash bit vector');
    const set = new Set();
    for (let word = 0; word < words; word++) { const bits = reader.u32(); for (let bit = 0; bit < 32; bit++) if (bits & (1 << bit)) {
      const index = word*32+bit; if (index >= capacity) fail('Native hash bucket outside capacity'); set.add(index);
    }}
    return set;
  }
  const present = bitVector(), deleted = bitVector(), names = new Map();
  if (present.size !== size || [...present].some(i => deleted.has(i))) fail('Invalid native hash occupancy');
  for (const ignored of present) {
    const at = reader.u32(), index = reader.u32(), name = zeroAt(strings,strings.start+at);
    if (!name || names.has(name) || !msf.streams[index]) fail('Invalid or duplicate native named stream');
    names.set(name,index);
  }
  if ((reader.end-reader.pos)%4) fail('Truncated native PDB feature codes');
  while (reader.pos < reader.end) {
    const feature = reader.u32();
    if (![0,20091201,20140508,0x4d544f4e].includes(feature)) fail('Unsupported native PDB feature code');
  }
  return names;
}
