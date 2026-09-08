import { createExceptionFrame, ExecutionLimitError } from './exception-frame.js';
import { matchesException, resolveExceptionType } from '../dotnet-runtime/exceptions.js';
import * as DN from '../dotnet-runtime/index.js';
import { methodKey, resolveAdapter } from './adapters.js';
import { typeName, stackType } from '../compiler-core/managed-types.js';
export { adapterInventory } from './adapters.js';
const fieldKey=f=>`${f.assembly}::${f.owner}::${f.token}`;
const slot=m=>`${m.name}(${m.signature.parameters.map(typeName).join(',')}):${typeName(m.signature.returnType)}`;
const initial=t=>stackType(t)==='ref'?null:stackType(t)==='i8'?0n:0;
function requireObject(value){if(value==null)throw new DN.NullReferenceException('NullReferenceException');return value;}
/** Runtime for emitted method functions. No opcode interpreter, PE loader, eval, or network. */
export function createBinaryRuntime({instructionBudget=1000000,maxDepth=256,maxArrayLength=1000000,log=()=>{}}={}){
  const assemblies=new Map(),types=new Map();let remaining=instructionBudget,depth=0,active=0,linked=false,debuggerHook=null;
  const host={log};
  function transaction(fn){if(!active)remaining=instructionBudget;active++;try{return fn();}finally{active--;}}
  function findType(assembly,name){const t=types.get(`${assembly}::${name}`);if(!t)throw new DN.NotSupportedException(`Missing binary type [${assembly}]${name}`);return t;}
  function resolve(context,token,kind){const local=context.records.get(token);if(!local)throw new DN.InvalidOperationException(`Missing metadata token ${token}`);if(local.assembly===context.descriptor.name&&token>>>24!==10)return {context,record:local};
    if(kind==='method'){const adapter=resolveAdapter(local);if(adapter)return {adapter,record:local};}
    const target=assemblies.get(local.assembly);if(!target)throw new DN.NotSupportedException(`Missing assembly ${local.assembly}`);
    const record=(kind==='field'?target.descriptor.fields:target.descriptor.methods).find(r=>kind==='field'?r.owner===local.owner&&r.name===local.name&&typeName(r.type)===typeName(local.type):methodKey(r)===methodKey(local));
    if(!record)throw new DN.NotSupportedException(`Missing ${kind} ${local.owner}::${local.name}`);return {context:target,record};
  }
  function initType(type){if(type.state==='done'||type.state==='busy')return;if(type.state==='failed')throw type.error;type.state='busy';try{if(type.base)initType(type.base);const cctor=type.context.descriptor.methods.find(m=>m.owner===type.record.name&&m.name==='.cctor');if(cctor)invokeRecord(type.context,cctor,null,[],false,true);type.state='done';}catch(e){type.state='failed';type.error=e;throw e;}}
  function invokeRecord(context,m,self,args,virtual=false,initializing=false){
    if(args.length!==m.signature.parameters.length)throw new DN.ArgumentException('Method argument count mismatch');
    if(!m.static)requireObject(self);
    if(virtual&&m.virtual&&self?.$binaryType){let current=self.$binaryType;while(current){const override=current.context.descriptor.methods.find(x=>x.owner===current.record.name&&x.virtual&&slot(x)===slot(m));if(override){if(current.record.name===m.owner||!(override.flags&0x100)){context=current.context;m=override;break;}}if(current.record.name===m.owner&&current.context===context)break;current=current.base;}}
    if(!initializing&&(m.static||m.name==='.ctor'))initType(findType(context.descriptor.name,m.owner));
    if(++depth>maxDepth){depth--;throw new ExecutionLimitError('Binary execution recursion budget exceeded');}
    try{const fn=context.functions[m.token];if(typeof fn!=='function')throw new DN.NotSupportedException('No emitted method body');return fn(self,args.map((v,i)=>['i4','i8','f'].includes(stackType(m.signature.parameters[i]))?coerce(m.signature.parameters[i],v):v));}finally{depth--;}
  }
  function coerce(type,value){
    const k=stackType(type);if(k==='i4'){if(typeof value==='boolean')value=Number(value);if(typeof value!=='number'||!Number.isInteger(value)||value<-2147483648||value>4294967295)throw new DN.ArgumentException('Expected a 32-bit integer');const n=value|0;return type==='int8'?n<<24>>24:type==='uint8'||type==='bool'?n&255:type==='int16'?n<<16>>16:type==='uint16'||type==='char'?n&65535:n;}
    if(k==='i8'){if(typeof value==='number'&&!Number.isSafeInteger(value))throw new DN.ArgumentException('Use BigInt or a decimal string for 64-bit values');return BigInt.asIntN(64,BigInt(value));}
    if(k==='f'){if(typeof value!=='number')throw new DN.ArgumentException('Expected floating-point value');return type==='float32'?Math.fround(value):value;}
    if(type==='string'&&value!=null&&typeof value!=='string')throw new DN.ArgumentException('Expected string');
    if(type?.kind==='array'&&value!=null){if(!Array.isArray(value)||value.length>maxArrayLength)throw new DN.ArgumentException('Expected bounded one-dimensional array');for(let i=0;i<value.length;i++)value[i]=coerce(type.element,value[i]);}
    return value;
  }
  function publicResult(m,value){if(m.signature.returnType==='bool')return !!value;if(m.signature.returnType==='uint32')return value>>>0;if(m.signature.returnType==='uint64')return BigInt.asUintN(64,value);return value;}
  function choose(type,name,args,isStatic){const found=type.context.descriptor.methods.filter(m=>m.owner===type.record.name&&m.name===name&&m.static===isStatic&&m.signature.parameters.length===args.length);if(found.length!==1)throw new DN.ArgumentException(`Ambiguous/missing ${name}; use a metadata token for same-arity overloads`);return found[0];}
  function allocate(type){initType(type);const object=Object.create(type.wrapper.prototype);Object.defineProperty(object,'$binaryType',{value:type});Object.defineProperty(object,'$fields',{value:new Map()});let parent=type;while(parent){for(const f of parent.context.descriptor.fields)if(f.owner===parent.record.name&&!f.static)object.$fields.set(fieldKey(f),initial(f.type));parent=parent.base;}return object;}
  function link(){if(linked)return;
    for(const type of types.values()){const base=type.record.base;if(base&&base.name!=='System.Object'){type.base=findType(base.assembly,base.name);const seen=new Set([type]);let p=type.base;while(p){if(seen.has(p))throw new Error('Binary inheritance cycle');seen.add(p);p=p.base;}}}
    for(const type of types.values()){
      function Wrapper(...args){return transaction(()=>{const m=choose(type,'.ctor',args,false),object=allocate(type);invokeRecord(type.context,m,object,args.map((v,i)=>coerce(m.signature.parameters[i],v)));return object;});}
      type.wrapper=Wrapper;Object.defineProperty(Wrapper,'$fullName',{value:type.record.name,configurable:true});
    }
    for(const type of types.values()){
      const wrapper=type.wrapper;if(type.base)Object.setPrototypeOf(wrapper.prototype,type.base.wrapper.prototype);
      const names=new Set(type.context.descriptor.methods.filter(m=>m.owner===type.record.name&&m.name[0]!=='.'&&(m.flags&7)===6).map(m=>m.name));
      for(const name of names){const group=type.context.descriptor.methods.filter(m=>m.owner===type.record.name&&m.name===name);for(const stat of new Set(group.map(m=>m.static)))Object.defineProperty(stat?wrapper:wrapper.prototype,name,{configurable:true,value:function(...args){return transaction(()=>{const m=choose(type,name,args,stat);return publicResult(m,invokeRecord(type.context,m,stat?null:this,args.map((v,i)=>coerce(m.signature.parameters[i],v)),!stat));});}});}
      for(const p of type.record.properties){const getter=p.get&&type.context.records.get(0x06000000+p.get),setter=p.set&&type.context.records.get(0x06000000+p.set);const stat=(getter??setter)?.static;const desc={configurable:true};if(getter)desc.get=function(){return transaction(()=>publicResult(getter,invokeRecord(type.context,getter,stat?null:this,[],!stat)));};if(setter)desc.set=function(v){transaction(()=>invokeRecord(type.context,setter,stat?null:this,[coerce(setter.signature.parameters[0],v)],!stat));};if(getter||setter)Object.defineProperty(stat?wrapper:wrapper.prototype,p.name,desc);}
    }
    linked=true;
  }
  const runtime={assemblies,types,D:DN,
    setDebugger(hook){if(hook!=null&&typeof hook!=='function')throw new TypeError('Debugger hook must be a function');debuggerHook=hook;},
    register(descriptor,factory){if(descriptor.format!=='msil-js-v1'||assemblies.has(descriptor.name))throw new Error('Invalid/duplicate binary assembly registration');if(linked)throw new Error('Register every assembly before linking');
      const C={descriptor,records:new Map([...descriptor.methods,...descriptor.fields,...descriptor.members].map(m=>[m.token,m])),D:DN,
        debugHit(point,locals){try{return debuggerHook?.(point,locals)===true;}catch{return false;}},
        tick(cost=1){remaining-=cost;if(remaining<0)throw new ExecutionLimitError('Binary execution instruction budget exceeded');},
        call(token,self,args,virtual=false){const target=resolve(C,token,'method');if(target.adapter){if(target.record.signature.hasThis)requireObject(self);return target.adapter(self,args,host);}return invokeRecord(target.context,target.record,self,args,virtual);},
        construct(token,args){const target=resolve(C,token,'method');if(target.adapter){const ExceptionType=resolveExceptionType({assembly:target.record.assembly,name:target.record.owner});if(ExceptionType)return new ExceptionType(...args);throw new DN.NotSupportedException('External constructor allocation unsupported');}const type=findType(target.context.descriptor.name,target.record.owner),object=allocate(type);invokeRecord(target.context,target.record,object,args);return object;},
        field(token,self,value,write=false){const target=resolve(C,token,'field'),f=target.record,type=findType(target.context.descriptor.name,f.owner);if(f.static)initType(type);const store=f.static?type.staticFields:requireObject(self).$fields;if(!(store instanceof Map)||!store.has(fieldKey(f)))throw new DN.InvalidOperationException('Object does not contain requested field');if(write)store.set(fieldKey(f),coerce(f.type,value));return store.get(fieldKey(f));},
        array(type,length){if(!Number.isInteger(length)||length<0||length>maxArrayLength)throw new DN.ArgumentException('Array allocation budget exceeded');C.tick(length);return DN.newArray(length,type==='i8'?0n:type==='ref'?null:0);},
        coerce,
        exceptionFrame:clauses=>createExceptionFrame(clauses,matchesException),
        long(op,a,b){a=BigInt(a);if(b!==undefined)b=BigInt(b);let v;switch(op){case 'add':v=a+b;break;case 'sub':v=a-b;break;case 'mul':v=a*b;break;case 'div':if(!b)throw new DN.DivideByZeroException();if(a===-(1n<<63n)&&b===-1n)throw new DN.OverflowException('Integer division overflow');v=a/b;break;case 'rem':if(!b)throw new DN.DivideByZeroException();v=a%b;break;case 'div.un':case 'rem.un':a=BigInt.asUintN(64,a);b=BigInt.asUintN(64,b);if(!b)throw new DN.DivideByZeroException();v=op==='div.un'?a/b:a%b;break;case 'and':v=a&b;break;case 'or':v=a|b;break;case 'xor':v=a^b;break;case 'shl':v=a<<(b&63n);break;case 'shr':v=a>>(b&63n);break;case 'shr.un':v=BigInt.asUintN(64,a)>>(b&63n);break;case 'neg':v=-a;break;case 'not':v=~a;break;default:throw new Error('Unsupported long operation');}return BigInt.asIntN(64,v);},
        convert(op,value,from){if(op==='r.un')return from==='i8'?Number(BigInt.asUintN(64,value)):Number(value>>>0);if(op==='r4')return Math.fround(Number(value));if(op==='r8')return Number(value);if(op==='i8'||op==='u8'){if(op==='u8'&&from==='i4')return BigInt(value>>>0);if(typeof value==='number'){if(!Number.isSafeInteger(Math.trunc(value)))throw new RangeError('Conversion beyond exact numeric profile');value=BigInt(Math.trunc(value));}return BigInt.asIntN(64,value);}const n=typeof value==='bigint'?Number(BigInt.asIntN(32,value)):Math.trunc(value);if(!Number.isFinite(n))throw new RangeError('Non-finite integer conversion');return ({i1:()=>n<<24>>24,u1:()=>n&255,i2:()=>n<<16>>16,u2:()=>n&65535,i4:()=>n|0,u4:()=>n|0})[op]();}
      };
      C.functions=factory(C);assemblies.set(descriptor.name,C);for(const record of descriptor.types){const staticFields=new Map(descriptor.fields.filter(f=>f.owner===record.name&&f.static).map(f=>[fieldKey(f),initial(f.type)]));types.set(`${descriptor.name}::${record.name}`,{record,context:C,staticFields,state:'new',base:null,wrapper:null});}return C;
    },
    link,
    invoke(assembly,token,args=[],self=null){return transaction(()=>{link();const C=assemblies.get(assembly);if(!C)throw new Error('Missing assembly '+assembly);const m=C.records.get(token);if(!m?.signature)throw new Error('Unknown method token');return publicResult(m,invokeRecord(C,m,self,args.map((v,i)=>coerce(m.signature.parameters[i],v)),!m.static));});},
    getType(assembly,name){link();return findType(assembly,name).wrapper;},
    exportTo(JB){link();for(const type of types.values())if(type.record.name!=='<Module>')JB.defineType(type.record.name,type.wrapper);return runtime;},
    stats(){return {assemblies:assemblies.size,types:types.size,remaining,depth};}
  };return runtime;
}
