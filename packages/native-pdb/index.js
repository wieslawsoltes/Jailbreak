import {align} from '../managed-pe/reader.js';
import {readMsf, readNamedStreams, zeroAt, hex, guid, fail} from './msf.js';
export {isNativePdb, readMsf} from './msf.js';
const algorithms = {1:'406ea660-64cf-4c82-b6f0-42d48172a799', 2:'ff1816ec-aa5e-4d10-87f7-6f4963833460', 3:'8829d00f-11b8-4213-878b-770e8597ac16'};
/** Windows MSF7/C13 managed symbols normalized to the shared source/IL model.
 * Native machine code, register locals and unrecognized executable records fail explicitly.
 */
export function readNativePdb(input, options = {}) {
  const msf = readMsf(input,options), header = msf.read(1);
  if (![19990903,20000404,20030901,20091201,20140508].includes(header.u32())) fail('Unsupported native PDB info version');
  const signature = header.u32(), age = header.u32(), rawGuid = header.slice(16), id = hex(rawGuid)+'-'+age;
  if (!age) fail('Native PDB age must be nonzero');
  const names = readNamedStreams(header,msf), global = names.has('/names') ? msf.read(names.get('/names')) : null;
  let strings = null;
  if (global) {
    if (global.u32() !== 0xeffeeffe || global.u32() !== 1) fail('Unsupported PDB string table');
    const n = global.u32(); strings = global.sub(global.pos,n);
  }
  const dbi = msf.read(3);
  if (dbi.u32() !== 0xffffffff || dbi.u32() !== 19990903 || dbi.u32() !== age) fail('Unsupported or mismatched DBI header');
  dbi.seek(24);
  const moduleSize = dbi.u32(), contributions = dbi.u32(), sectionMap = dbi.u32(), filesSize = dbi.u32(), typeServers = dbi.u32();
  dbi.skip(4); const optional = dbi.u32(), ec = dbi.u32(); dbi.skip(8);
  dbi.check(64,moduleSize+contributions+sectionMap+filesSize+typeServers+optional+ec);
  const modules = dbi.sub(64,moduleSize), documents = [], docByName = new Map(), methods = [], tokens = new Set();
  let recordCount = 0, pointCount = 0;
  const maxRows = options.maxRows ?? 200000, maxPoints = options.maxPoints ?? 500000;
  for (const [name,value,limit] of [['maxRows',maxRows,1000000],['maxPoints',maxPoints,2000000]])
    if (!Number.isSafeInteger(value) || value < 1 || value > limit) fail('Invalid native '+name+' budget');
  function document(name,algorithm,hash) {
    const key = name.replace(/\//g,'\\').toLowerCase(); let doc = docByName.get(key);
    if (doc) {
      if (hash && (doc.hash !== hash || doc.hashAlgorithm !== algorithms[algorithm])) fail('Conflicting duplicate native document checksum');
      return doc;
    }
    doc = {id:documents.length+1, name, hashAlgorithm:algorithms[algorithm] ?? '00000000-0000-0000-0000-000000000000', hash, language:'3f5162f8-07c6-11d3-9053-00c04fa302a1'};
    const index = names.get('/src/files/'+key);
    if (index !== undefined) {
      const src = msf.read(index); doc.language = guid(src.slice(16)); src.skip(32);
      const checksumAlgorithm = guid(src.slice(16)), checksumSize = src.u32(), sourceSize = src.u32();
      if (checksumSize > 64) fail('Native source checksum budget exceeded');
      const checksum = hex(src.slice(checksumSize));
      if (hash && (hash !== checksum || doc.hashAlgorithm !== checksumAlgorithm)) fail('Conflicting source checksums in native PDB');
      doc.hash = checksum; doc.hashAlgorithm = checksumAlgorithm;
      // Legacy native embedded-source encodings are not Portable PDB EmbeddedSource.
      if (sourceSize) fail('Legacy native embedded-source payload needs a supported decoder');
      if (src.pos !== src.end) fail('Unexpected native source payload');
    }
    if (documents.length >= maxRows) fail('Native document budget exceeded');
    documents.push(doc); docByName.set(key,doc); return doc;
  }
  while (modules.pos < modules.end) {
    if (++recordCount > maxRows) fail('Native module budget exceeded');
    const start = modules.pos; modules.skip(34);
    const stream = modules.u16(), symbolBytes = modules.u32(), c11Bytes = modules.u32(), c13Bytes = modules.u32(); modules.skip(16);
    const moduleName = modules.zeroString(8192); modules.zeroString(8192); modules.seek(align(modules.pos,4));
    if (c11Bytes) fail('C11 native line tables are unsupported',start);
    if (stream === 0xffff) { if (symbolBytes || c13Bytes) fail('Native module has sizes but no stream'); continue; }
    const data = msf.read(stream); data.check(0,symbolBytes+c13Bytes);
    if (symbolBytes < 4 || data.u32() !== 4) fail('Expected CodeView C13 module symbols');
    const symbols = data.sub(4,symbolBytes-4), moduleMethods = [], stack = [];
    while (symbols.pos < symbols.end) {
      if (++recordCount > maxRows) fail('Native symbol record budget exceeded');
      const at = symbols.pos, length = symbols.u16(), kind = symbols.u16();
      if (length < 2) fail('Invalid CodeView record length',at);
      const r = symbols.sub(symbols.pos,length-2); symbols.skip(length-2);
      if (kind === 0x112a || kind === 0x112b) { // S_GMANPROC / S_LMANPROC
        if (stack.length) fail('Nested managed procedure records are unsupported',at);
        const parent = r.u32(), endRecord = r.u32(); r.u32();
        const codeSize = r.u32(); r.skip(8);
        const token = r.u32(), codeOffset = r.u32(), segment = r.u16(); r.u8(); r.u16();
        const name = r.pos < r.end ? r.zeroString(4096) : '';
        if (parent || token >>> 24 !== 6 || !(token & 0xffffff) || !codeSize || codeSize > 1000000 || tokens.has(token) || endRecord <= at || endRecord >= symbolBytes) fail('Invalid managed procedure metadata',at);
        const method = {token,name,module:moduleName,codeSize,codeOffset,segment,localSignature:null,points:[],scopes:[]};
        tokens.add(token); moduleMethods.push(method); methods.push(method);
        stack.push({at,endRecord,method,start:0,end:codeSize,variables:[]});
      } else if (kind === 0x1103) { // S_BLOCK32
        if (!stack.length) fail('Block outside a managed procedure',at);
        const parent = r.u32(), endRecord = r.u32(), length = r.u32(), offset = r.u32(), segment = r.u16();
        const outer = stack.at(-1), method = outer.method, begin = offset-method.codeOffset;
        if (parent !== outer.at || endRecord <= at || endRecord >= outer.endRecord || segment !== method.segment || begin < outer.start || begin+length > outer.end || !length) fail('Invalid native lexical scope',at);
        stack.push({at,endRecord,method,start:begin,end:begin+length,variables:[]});
      } else if (kind === 6) { // S_END
        const scope = stack.pop();
        if (!scope || scope.endRecord !== at) fail('Mismatched CodeView scope end',at);
        if (scope.variables.length) scope.method.scopes.push({start:scope.start,end:scope.end,variables:scope.variables});
      } else if (kind === 0x1120) { // S_MANSLOT
        if (!stack.length) fail('Managed local outside lexical scope',at);
        const slot = r.u32(); r.u32(); const liveOffset = r.u32(), segment = r.u16(), flags = r.u16(), name = r.zeroString(4096);
        if (!name || slot > 65535 || flags & ~0x7ff || flags & 1 || liveOffset || segment) fail('Unsupported native local storage attributes',at);
        const vars = stack.at(-1).variables;
        if (vars.some(v => v.slot === slot || v.name === name)) fail('Duplicate local in native scope',at);
        vars.push({slot,name,hidden:!!(flags & (4|256))});
      } else if (![0x404,0x1124,0x1101,0x1116,0x113c,0x113d].includes(kind)) {
        fail('Unsupported native symbol record 0x'+kind.toString(16),at);
      }
    }
    if (stack.length) fail('Unclosed managed CodeView scopes');
    const c13 = data.sub(symbolBytes,c13Bytes), subsections = [], checksums = new Map(); let localStrings = null;
    while (c13.pos < c13.end) {
      if (++recordCount > maxRows) fail('Native subsection budget exceeded');
      const at = c13.pos, kind = c13.u32(), size = c13.u32(), body = c13.sub(c13.pos,size);
      c13.seek(align(c13.pos+size,4)); if (kind & 0x80000000) continue;
      if (kind === 0xf3) { if (localStrings) fail('Duplicate C13 string table'); localStrings = body; }
      else if (kind === 0xf4) { if (subsections.some(s => s.kind === kind)) fail('Duplicate C13 checksum table'); subsections.push({kind,body}); }
      else if (kind === 0xf2 || kind === 0xf9) subsections.push({kind,body});
      else fail('Unsupported native C13 subsection 0x'+kind.toString(16),at);
    }
    for (const {kind,body} of subsections) if (kind === 0xf4) {
      const base = body.start;
      while (body.pos < body.end) {
        if (++recordCount > maxRows) fail('Native checksum record budget exceeded');
        const offset = body.pos-base, nameOffset = body.u32(), length = body.u8(), algorithm = body.u8(), table = localStrings ?? strings;
        if (!table || [0,16,20,32][algorithm] !== length) fail('Invalid native document checksum record');
        const hash = hex(body.slice(length)); body.seek(align(body.pos,4));
        checksums.set(offset,document(zeroAt(table,table.start+nameOffset),algorithm,hash));
      }
    }
    for (const {kind,body} of subsections) if (kind === 0xf2 || kind === 0xf9) {
      const offset = body.u32(), segment = body.u16(), flags = body.u16(), size = body.u32();
      if (flags & ~1 || !size) fail('Invalid C13 line contribution');
      const owners = moduleMethods.filter(m => m.segment === segment && offset >= m.codeOffset && offset+size <= m.codeOffset+m.codeSize);
      if (owners.length !== 1) fail('Line contribution does not belong to exactly one managed method');
      const method = owners[0];
      while (body.pos < body.end) {
        const at = body.pos, doc = checksums.get(body.u32()), count = body.u32(), blockSize = body.u32();
        if (!doc || (pointCount += count) > maxPoints || blockSize !== 12+count*(flags&1 ? 12 : 8)) fail('Invalid or oversized native line block');
        body.check(at,blockSize); const points = []; let prior = -1;
        for (let i = 0; i < count; i++) {
          const delta = body.u32(), bits = body.u32(), line = bits & 0xffffff, endLine = line+((bits>>>24)&127);
          if (delta <= prior || delta >= size || !line || endLine > 0xfeefee) fail('Invalid C13 sequence point'); prior = delta;
          points.push({offset:offset-method.codeOffset+delta,document:doc.id,line,endLine,column:0,endColumn:0,hidden:line===0xfeefee});
        }
        if (flags & 1) for (const point of points) {
          point.column = body.u16(); point.endColumn = body.u16();
          if (!point.hidden && point.endLine === point.line && point.endColumn < point.column) fail('Invalid native source columns');
        }
        method.points.push(...points);
      }
    }
    for (const method of moduleMethods) {
      method.scopes.sort((a,b) => a.start-b.start || b.end-a.end); method.points.sort((a,b) => a.offset-b.offset);
      for (let i = 1; i < method.points.length; i++) if (method.points[i].offset === method.points[i-1].offset) fail('Duplicate native method sequence point');
    }
  }
  if (!methods.length) fail('PDB contains no supported managed methods');
  return {format:'native-pdb',id,age,guid:hex(rawGuid),signature,documents,methods,entryPoint:0,externalCounts:[],stateMachines:[],custom:[]};
}
