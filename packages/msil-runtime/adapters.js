import { resolveExceptionType, exceptionTypeNames } from '../dotnet-runtime/exceptions.js';
import * as DN from '../dotnet-runtime/index.js';
import { typeName } from '../compiler-core/managed-types.js';
export function methodKey(m){return `${m.owner}::${m.name}(${m.signature.parameters.map(typeName).join(',')}):${typeName(m.signature.returnType)}${m.signature.hasThis?':instance':''}`;}
const adapters=new Map();
function add(owner,name,parameters,returnType,fn,hasThis=false){adapters.set(methodKey({owner,name,signature:{parameters,returnType,hasThis}}),fn);}
add('System.Object','.ctor',[],'void',()=>{},true);
for(let n=2;n<=4;n++)add('System.String','Concat',Array(n).fill('string'),'string',(_,args)=>DN.StringApi.Concat(...args));
add('System.String','get_Length',[],'int32',self=>DN.length(self),true);
add('System.String','op_Equality',['string','string'],'bool',(_,a)=>a[0]===a[1]?1:0);
add('System.String','op_Inequality',['string','string'],'bool',(_,a)=>a[0]!==a[1]?1:0);
add('System.String','IsNullOrEmpty',['string'],'bool',(_,a)=>DN.StringApi.IsNullOrEmpty(a[0])?1:0);
for(const t of ['int32','float64'])for(const [name,fn,n]of [['Abs',Math.abs,1],['Min',Math.min,2],['Max',Math.max,2]])add('System.Math',name,Array(n).fill(t),t,(_,args)=>{if(t==='int32'&&name==='Abs'&&args[0]===-2147483648)throw new DN.OverflowException('Integer absolute value overflow');return fn(...args);});
for(const name of ['Sqrt','Floor','Ceiling','Sin','Cos','Tan'])add('System.Math',name,['float64'],'float64',(_,a)=>Math[name==='Ceiling'?'ceil':name.toLowerCase()](a[0]));
add('System.Math','Pow',['float64','float64'],'float64',(_,a)=>Math.pow(...a));
for(const t of ['string','int32','float64','bool'])add('System.Console','WriteLine',[t],'void',(_,a,host)=>host.log(t==='bool'?a[0]?'True':'False':a[0]));
const systemAssemblies=new Set(['System.Runtime','System.Private.CoreLib','mscorlib','netstandard','System.Console']);
export function resolveAdapter(m){return systemAssemblies.has(m.assembly)?adapters.get(methodKey(m)):undefined;}
export function adapterInventory(){return [...adapters.keys()].sort();}

for(const owner of exceptionTypeNames()){
  for(const parameters of [[],["string"],["string",{kind:"class",assembly:"System.Runtime",name:"System.Exception"}]])add(owner,".ctor",parameters,"void",(self,args)=>{const C=resolveExceptionType({assembly:"System.Runtime",name:owner});return new C(...args);},true);
  add(owner,"get_Message",[],"string",self=>self.Message,true);
  add(owner,"get_InnerException",[],{kind:"class",assembly:"System.Runtime",name:"System.Exception"},self=>self.InnerException,true);
}
