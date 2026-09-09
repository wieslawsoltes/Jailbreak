import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {restoreSymbols,planSymbolRestore,symbolStoreKey,parseSourceLink,resolveSourceLink,sourceLinkFromPdb} from '../packages/symbol-restoration/index.js';
import {createDownloadSession,checkedUrl,approvedOrigins} from '../packages/symbol-restoration/network.js';
import {readPortablePdb} from '../packages/portable-pdb/index.js';
import {compileBinaryInputs} from '../packages/msil-compiler/debug.js';
import {createBinaryRuntime} from '../packages/msil-runtime/index.js';
const portable=JSON.parse(fs.readFileSync(new URL('./fixtures/msil/pdb.json',import.meta.url)));
const native=JSON.parse(fs.readFileSync(new URL('./fixtures/msil/native-pdb.json',import.meta.url)));
const bytes=(fixture,name)=>new Uint8Array(Buffer.from(fixture.files[name].base64,'base64'));
const dll='Jailbreak.PdbExamples.dll',pdbName='Jailbreak.PdbExamples.pdb';
const input=()=>({path:dll,bytes:bytes(portable,dll)});
const policy={consent:true,symbolServers:['https://symbols.example/store'],sourceOrigins:['https://raw.githubusercontent.com']};
function fetchFixture(f=portable,overrides={}){
 const calls=[];const fetch=async(url,options)=>{calls.push({url,options});if(overrides.respond)return overrides.respond(url,options,calls.length);
  if(url.endsWith('.pdb'))return new Response(bytes(f,Object.keys(f.files).find(n=>n.endsWith('.pdb'))));
  return new Response(overrides.source??f.source);
 };return {fetch,calls};
}
test('symbol store keys match official GUID endianness and portable/native index formats',()=>{
 const key=symbolStoreKey({format:'portable-pdb',path:'C:\\pdb\\Demo.PDB',id:'00112233445566778899aabbccddeeff12345678'});
 assert.equal(key,'demo.pdb/33221100554477668899aabbccddeeffFFFFFFFF/demo.pdb');
 assert.equal(symbolStoreKey({format:'native-pdb',path:'/build/Demo.pdb',guid:'00112233445566778899aabbccddeeff',age:15}),'demo.pdb/33221100554477668899aabbccddeefff/demo.pdb');
 for(const path of ['../bad?.pdb','x#y.pdb','x%2fy.pdb','x\u0000.pdb'])assert.throws(()=>symbolStoreKey({format:'portable-pdb',path,id:'0'.repeat(40)}));
});
test('planning requests inspects real DLL identity without network and preserves bytes',()=>{
 const a=input(),before=new Uint8Array(a.bytes),plan=planSymbolRestore(a,policy);
 assert.equal(plan.requests.length,1);assert.equal(plan.assembly,'Jailbreak.PdbExamples');assert.match(plan.requests[0],/bf00cf89ecfc447bb0479e64ce31e91eFFFFFFFF/);assert.deepEqual(a.bytes,before);
});
test('Source Link gives exact and longest-prefix mappings priority and encodes path data',()=>{
 const map=parseSourceLink({documents:{'C:\\src\\*':'https://raw.example/base/*','C:\\src\\ui\\*':'https://raw.example/ui/*','C:\\src\\ui\\View.cs':'https://raw.example/special.cs'}});
 assert.equal(resolveSourceLink(map,'c:/SRC/UI/View.cs'),'https://raw.example/special.cs');
 assert.equal(resolveSourceLink(map,'C:\\src\\ui\\A #?.cs'),'https://raw.example/ui/A%20%23%3F.cs');
 assert.equal(resolveSourceLink(map,'D:/unmapped.cs'),null);
 assert.throws(()=>resolveSourceLink(map,'C:/src/ui/../secret.cs'),/Unsafe/);
 const unicode=parseSourceLink({documents:{'/İ/*':'https://raw.example/*'}});assert.equal(resolveSourceLink(unicode,'/İ/Å.cs'),'https://raw.example/%C3%85.cs');
});
test('Source Link rejects ambiguous case mappings wildcard misuse and executable URLs',()=>{
 for(const documents of [{'a':'https://x/*'},{'a*b':'https://x/*'},{'a*':'https://x/*/*'},{a:'javascript:evil()'},{a:'https://user:secret@x/code'},{a:'https://x/a',A:'https://x/b'}])assert.throws(()=>parseSourceLink({documents}));
 assert.throws(()=>parseSourceLink('{"documents": []}'));assert.throws(()=>parseSourceLink({}));
 const p=readPortablePdb(bytes(portable,pdbName));assert.ok(sourceLinkFromPdb(p).length);const c=p.custom.find(c=>c.kind==='cc110556-a091-4d38-9fec-25ab9a351a6a');assert.throws(()=>sourceLinkFromPdb({...p,custom:[c,c]}),/Duplicate/);
});
test('no network occurs without consent or on an invalid origin policy',async()=>{
 const f=fetchFixture();await assert.rejects(()=>restoreSymbols(input(),{...policy,consent:false,fetch:f.fetch}),/consent/);assert.equal(f.calls.length,0);
 for(const sourceOrigins of [['https://x/path'],['https://user:pw@x'],['http://example.com'],['file:///tmp']])await assert.rejects(()=>restoreSymbols(input(),{...policy,sourceOrigins,fetch:f.fetch}));assert.equal(f.calls.length,0);
 assert.equal(checkedUrl('http://127.0.0.1:8080',{allowLocalHttp:true}).origin,'http://127.0.0.1:8080');assert.throws(()=>checkedUrl('http://127.0.0.1:8080'));assert.throws(()=>approvedOrigins(['https://x/?token=secret']));
});
test('real SDK Portable PDB is fetched verified and compiled without original-source substitutes',async()=>{
 const f=fetchFixture(),r=await restoreSymbols(input(),{...policy,fetch:f.fetch});assert.equal(f.calls.length,1);assert.deepEqual(r.pdb,bytes(portable,pdbName));assert.deepEqual(Object.values(r.sources),[portable.source]);assert.equal(r.report.checksumVerified,true);
 const options=f.calls[0].options;assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.referrerPolicy,'no-referrer');
 const compiled=await compileBinaryInputs([{path:dll,bytes:r.bytes},{path:pdbName,bytes:r.pdb},...Object.entries(r.sources).map(([path,text])=>({path,text}))],{debug:true});assert.equal(compiled.success,true,JSON.stringify(compiled.diagnostics));
 const MS=createBinaryRuntime();new Function('MS',compiled.code)(MS);assert.equal(MS.getType('Jailbreak.PdbExamples','PdbExamples.Calculations').Sum(10),45);
});
test('refresh can retrieve checksummed source from the real SDK Source Link record',async()=>{
 const f=fetchFixture(),r=await restoreSymbols(input(),{...policy,refreshSources:true,fetch:f.fetch});assert.equal(f.calls.length,2);assert.match(f.calls[1].url,/raw\.githubusercontent\.com\/wieslawsoltes\/Jailbreak\/220dce3024e4fcf136c99236fb20d993ceec7e52\/tests\/fixtures\/pdb-src\/Calculations.cs/);assert.deepEqual(Object.values(r.sources),[portable.source]);
});
test('unapproved Source Link host blocks source requests after PDB validation',async()=>{
 const f=fetchFixture();await assert.rejects(()=>restoreSymbols(input(),{...policy,sourceOrigins:[],refreshSources:true,fetch:f.fetch}),/Approve Source Link origin/);assert.equal(f.calls.length,1);
});
test('wrong PDB identity or source checksum cannot be returned as a restored attachment',async()=>{
 const bad=fetchFixture(native);await assert.rejects(()=>restoreSymbols(input(),{...policy,fetch:bad.fetch}),/identity/);
 const f=fetchFixture(portable,{source:portable.source+'// wrong'});await assert.rejects(()=>restoreSymbols(input(),{...policy,refreshSources:true,fetch:f.fetch}),/checksum mismatch/);
});
test('provided native PDB and explicit source map restore original CRLF text',async()=>{
 const name='Jailbreak.NativeSymbols.dll',f=fetchFixture(native);
 const r=await restoreSymbols({path:name,bytes:bytes(native,name),pdb:bytes(native,'Jailbreak.NativeSymbols.pdb')},{consent:true,sourceMap:{documents:{'*':'https://sources.example/*'}},sourceOrigins:['https://sources.example'],fetch:f.fetch});
 assert.equal(r.report.format,'native-pdb');assert.deepEqual(Object.values(r.sources),[native.source]);assert.equal(f.calls.length,1);assert.equal(r.report.missingDocuments.length,0);
});
test('missing source is explicit and partial source restoration needs opt-out',async()=>{
 const a={path:'Jailbreak.NativeSymbols.dll',bytes:bytes(native,'Jailbreak.NativeSymbols.dll'),pdb:bytes(native,'Jailbreak.NativeSymbols.pdb')};const f=fetchFixture();
 await assert.rejects(()=>restoreSymbols(a,{consent:true,fetch:f.fetch}),/Original source is unavailable/);
 const result=await restoreSymbols(a,{consent:true,requireSources:false,fetch:f.fetch});assert.equal(result.report.missingDocuments.length,1);assert.equal(result.report.verifiedDocuments,0);assert.equal(f.calls.length,0);
});
test('only 404 moves to another explicitly listed server; authentication errors stop',async()=>{
 const f=fetchFixture(portable,{respond:(url,o,n)=>n===1?new Response(null,{status:404}):new Response(bytes(portable,pdbName))});
 const r=await restoreSymbols(input(),{...policy,symbolServers:['https://one.example','https://two.example'],fetch:f.fetch});assert.equal(f.calls.length,2);assert.equal(r.report.requests[0].status,'not-found');
 const err=fetchFixture(portable,{respond:()=>new Response(null,{status:401})});await assert.rejects(()=>restoreSymbols(input(),{...policy,symbolServers:['https://one.example','https://two.example'],fetch:err.fetch}),/HTTP 401/);assert.equal(err.calls.length,1);
});
test('redirects and changed response origins are rejected even with otherwise valid bytes',async()=>{
 for(const properties of [{redirected:{value:true}},{url:{value:'https://another.example/code'}}]){const f=fetchFixture(portable,{respond:()=>{const r=new Response(bytes(portable,pdbName));Object.defineProperties(r,properties);return r;}});await assert.rejects(()=>restoreSymbols(input(),{...policy,fetch:f.fetch}),/Redirected/);}
});
test('download sizes and counts are enforced while streaming, not just by content-length',async()=>{
 const f=fetchFixture();await assert.rejects(()=>restoreSymbols(input(),{...policy,maxBytes:10,fetch:f.fetch}),/byte budget/);
 await assert.rejects(()=>restoreSymbols(input(),{...policy,maxRequests:1,refreshSources:true,fetch:f.fetch}),/request budget/);
 const huge=fetchFixture(portable,{respond:()=>new Response('small',{headers:{'content-length':'999999999'}})});await assert.rejects(()=>restoreSymbols(input(),{...policy,fetch:huge.fetch}),/content length/);
});
test('cancelled and timed-out downloads stop without publishing partial symbols',async()=>{
 const c=new AbortController();c.abort(new Error('owned cancellation'));const f=fetchFixture();await assert.rejects(()=>restoreSymbols(input(),{...policy,signal:c.signal,fetch:f.fetch}),/owned cancellation/);assert.equal(f.calls.length,0);
 const never=()=>new Promise(()=>{});await assert.rejects(()=>restoreSymbols(input(),{...policy,timeoutMs:5,fetch:never}),/timed out/);
 const controller=new AbortController();let cancel=false;const stream=new ReadableStream({pull(){controller.abort(new Error('mid-stream'));},cancel(){cancel=true;}});
 await assert.rejects(()=>restoreSymbols(input(),{...policy,signal:controller.signal,fetch:async()=>new Response(stream)}),/mid-stream/);assert.equal(cancel,true);
});
test('a closed session and an unapproved origin cannot issue requests',async()=>{
 const f=fetchFixture(),session=createDownloadSession({consent:true,fetch:f.fetch});await assert.rejects(()=>session.get('https://unapproved.example',new Set()),/not approved/);session.close();await assert.rejects(()=>session.get('https://symbols.example',new Set(['https://symbols.example'])),/closed/);assert.equal(f.calls.length,0);
});
