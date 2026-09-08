// ECMA-335 II.22 column widths. s/b/g are heap indices; numbers are table indices.
export const coded = {
  TypeDefOrRef: [2, [2, 1, 27]], HasConstant: [2, [4, 8, 23]],
  HasCustomAttribute: [5, [6,4,1,2,8,9,10,0,14,23,20,17,26,27,32,35,38,39,40,42,44,43]],
  HasFieldMarshal: [1,[4,8]], HasDeclSecurity:[2,[2,6,32]], MemberRefParent:[3,[2,1,26,6,27]],
  HasSemantics:[1,[20,23]], MethodDefOrRef:[1,[6,10]], MemberForwarded:[1,[4,6]],
  Implementation:[2,[38,35,39]], CustomAttributeType:[3,[null,null,6,10]],
  ResolutionScope:[2,[0,26,35,1]], TypeOrMethodDef:[1,[2,6]]
};
export const layouts = [
  ['u2','s','g','g','g'], ['ResolutionScope','s','s'], ['u4','s','s','TypeDefOrRef',4,6], [4],
  ['u2','s','b'], [6], ['u4','u2','u2','s','b',8], [8], ['u2','u2','s'], [2,'TypeDefOrRef'],
  ['MemberRefParent','s','b'], ['u2','HasConstant','b'], ['HasCustomAttribute','CustomAttributeType','b'],
  ['HasFieldMarshal','b'], ['u2','HasDeclSecurity','b'], ['u2','u4',2], ['u4',4], ['b'],
  [2,20], [20], ['u2','s','TypeDefOrRef'], [2,23], [23], ['u2','s','b'], ['u2',6,'HasSemantics'],
  [2,'MethodDefOrRef','MethodDefOrRef'], ['s'], ['b'], ['u2','MemberForwarded','s',26], ['u4',4],
  ['u4','u4'], ['u4'], ['u4','u2','u2','u2','u2','u4','b','s','s'], ['u4'], ['u4','u4','u4'],
  ['u2','u2','u2','u2','u4','b','s','s','b'], ['u4',35], ['u4','u4','u4',35],
  ['u4','s','b'], ['u4','u4','s','s','Implementation'], ['u4','u4','s','Implementation'], [2,2],
  ['u2','u2','TypeOrMethodDef','s'], ['MethodDefOrRef','b'], [42,'TypeDefOrRef']
];
export function readTables(data) {
  const heap = data.u8(6), counts = Array(64).fill(0), rows = Array.from({length:64},()=>[]);
  let at = 24, total = 0;
  for(let i=0;i<64;i++) if(data.u8(8+(i>>3)) & (1<<(i&7))) { counts[i] = data.u32(at); at+=4; total+=counts[i]; }
  if(total>500000) throw new Error('Metadata row budget exceeded');
  const width = column => typeof column==='number' ? (counts[column]<65536?2:4) : column==='u2'?2:column==='u4'?4:
    ['s','g','b'].includes(column)?(heap & {s:1,g:2,b:4}[column]?4:2):coded[column][1].some(t=>t!==null&&counts[t]>=2**(16-coded[column][0]))?4:2;
  for(let table=0;table<64;table++) {
    if(!counts[table])continue;
    if(!layouts[table])throw new Error(`Unsupported metadata table ${table}`);
    const widths=layouts[table].map(width),stride=widths.reduce((a,b)=>a+b,0);data.check(at,counts[table]*stride);
    for(let i=0;i<counts[table];i++){const row=[];for(const w of widths){row.push(w===2?data.u16(at):data.u32(at));at+=w;}rows[table].push(row);}
  }
  function row(table,rid) { if(!rid||rid>rows[table].length)throw new Error(`Invalid metadata token ${table}:${rid}`);return rows[table][rid-1]; }
  function decode(name,value) {const [bits,tables]=coded[name],table=tables[value & ((1<<bits)-1)],rid=value>>>bits;if(table==null||!rid)throw new Error(`Invalid ${name} coded index`);row(table,rid);return {table,rid,token:(table*16777216+rid)>>>0};}
  return {rows,counts,row,decode};
}
