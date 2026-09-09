import {decodeIL,disassemble} from './instruction-set.js';
/** Symbol-free code is exposed as explicitly labeled disassembly, never as
 * reconstructed original C#. Authored IL retains its actual input coordinates. */
export function addContinuationSites(assemblies,debug){
  for(const assembly of assemblies)for(const method of assembly.methods){
    const key=assembly.name+'|'+method.token;
    if(debug.byMethod.get(key)?.length||!method.body)continue;
    const instructions=method.instructions??decodeIL(method.body.code);
    const file=assembly.source?.path??`jailbreak-il/${encodeURIComponent(assembly.name)}/${method.token.toString(16)}.il`;
    const text=assembly.source?.text??disassemble({...method,instructions});
    if(Object.hasOwn(debug.sources,file)&&debug.sources[file]!==text)throw new Error('Conflicting IL source: '+file);
    debug.sources[file]=text;let offset=0;
    const entries=instructions.map((i,index)=>{
      const location=assembly.source?assembly.source.location(i.sourceOffset??method.body.offset??0):{file,line:index+1,column:1,offset};
      const point={id:'il_'+debug.sites.length,...location,ilOffset:i.offset,token:method.token,assembly:assembly.name,method:method.owner+'.'+method.name,language:'msil',origin:'msil',sourceKind:assembly.source?'il-source':'disassembly',cooperative:true};
      debug.sites.push(point);if(!assembly.source)offset=text.indexOf('\n',offset)+1;
      return {point,locals:method.body.locals.map((_,slot)=>({name:'local'+slot,slot}))};
    });
    debug.byMethod.set(key,entries);
  }
  return debug;
}
