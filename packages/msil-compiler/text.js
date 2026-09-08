import { BinaryError } from '../managed-pe/reader.js';
import { SourceFile } from '../compiler-core/index.js';
import { byName } from './instruction-set.js';
/** A token parser for a documented ILAsm subset. This is not a regex transpiler. */
export function parseIL(text,{path='source.il',maxTokens=200000}={}){
  const source=new SourceFile(path,text),tokens=[];let p=0;
  const error=(message,at=p)=>{const e=new BinaryError(message,at,'JB6201');e.location=source.location(at);throw e;};
  while(p<text.length){if(tokens.length>maxTokens)error('Text IL token budget exceeded');if(/\s/.test(text[p])){p++;continue;}if(text.startsWith('//',p)){while(p<text.length&&text[p]!=='\n')p++;continue;}if(text.startsWith('/*',p)){const end=text.indexOf('*/',p+2);if(end<0)error('Unclosed comment');p=end+2;continue;}const start=p,c=text[p];
    if(c==='"'||c==="'"){const quote=c;p++;let value='';while(p<text.length&&text[p]!==quote){if(text[p]==='\\'){p++;const escape=text[p++];if(escape==='u'){const hex=text.slice(p,p+4);if(!/^[\da-f]{4}$/i.test(hex))error('Invalid unicode escape');value+=String.fromCharCode(parseInt(hex,16));p+=4;}else {const escapes={n:'\n',r:'\r',t:'\t','0':'\0','\\':'\\','"':'"',"'":"'"};if(!(escape in escapes))error('Unsupported string escape');value+=escapes[escape];}}else value+=text[p++];}if(text[p++]!==quote)error('Unclosed IL string');tokens.push({value,start,string:quote==='"'});continue;}
    if(text.startsWith('::',p)){tokens.push({value:'::',start});p+=2;continue;}
    if('{}()[],:='.includes(c)){tokens.push({value:c,start});p++;continue;}
    const match=/^[A-Za-z_$@.][A-Za-z0-9_$@.`+\/\-]*|^-?(?:0x[\da-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(p));if(!match)error('Unexpected IL character '+c);tokens.push({value:match[0],start});p+=match[0].length;
  }
  tokens.push({value:'<eof>',start:text.length});let cursor=0,currentType=null,methodId=0,fieldId=0,memberId=0,stringId=0,typeId=0;
  const peek=()=>tokens[cursor],take=value=>peek().value===value?(cursor++,true):false,expect=value=>{if(!take(value))error(`Expected '${value}', got '${peek().value}'`,peek().start);},name=()=>{const t=tokens[cursor++];if(!t||/^[{}()[\],:=]$/.test(t.value)||t.value==='<eof>')error('Expected identifier',t?.start);return t.value;};
  const number=()=>{const t=tokens[cursor++],n=Number(t.value);if(!Number.isFinite(n))error('Expected finite number',t.start);return n;};
  const a={format:'cli-assembly-v1',path,name:'IL.Sample',version:'1.0.0.0',cliFlags:1,nativeHeader:0,entryPoint:0,features:{},types:[],fields:[],methods:[],members:[],references:[],userStrings:{},resources:[],tables:{}};
  const typeRefs=new Map(),aliases={int8:'int8',uint8:'uint8',int16:'int16',uint16:'uint16',int32:'int32',uint32:'uint32',int64:'int64',uint64:'uint64',float32:'float32',float64:'float64',string:'string',object:'object',bool:'bool',char:'char',void:'void'};
  function typeReference(){let assembly=a.name;if(take('[')){assembly=name();expect(']');}const value=name();return {name:value,assembly};}
  function type(){take('class');let value;if(aliases[peek().value])value=aliases[name()];else value={kind:'class',...typeReference()};if(peek().value==='['&&tokens[cursor+1]?.value===']'){cursor+=2;value={kind:'array',rank:1,element:value};}return value;}
  function parameters(names=false){expect('(');const result=[];while(!take(')')){result.push(type());if(names&&![')',','].includes(peek().value))name();if(peek().value!==')')expect(',');}return result;}
  function modifiers(allowed){const values=[];while(allowed.includes(peek().value))values.push(name());return values;}
  function methodReference(){const hasThis=take('instance'),returnType=type(),owner=typeReference();expect('::');const methodName=name(),params=parameters();const ref={token:0x0a000000+(++memberId),kind:'method',name:methodName,owner:owner.name,assembly:owner.assembly,signature:{hasThis,explicitThis:false,callingConvention:0,genericArity:0,returnType,parameters:params}};a.members.push(ref);return ref.token;}
  while(peek().value!=='<eof>'){
    if(take('.assembly')){const external=take('extern'),assemblyName=name();expect('{');if(!take('}'))error('Only empty assembly metadata blocks are supported',peek().start);if(external)a.references.push({name:assemblyName,version:'0.0.0.0'});else a.name=assemblyName;}
    else if(take('.module'))name();
    else if(take('.class')){
      const mods=modifiers(['public','private','auto','ansi','beforefieldinit','sealed','abstract']);const typeName=name(),base=take('extends')?typeReference():{name:'System.Object',assembly:'System.Runtime'};currentType={token:0x02000000+(++typeId),name:typeName,assembly:a.name,flags:(mods.includes('public')?1:0)|(mods.includes('abstract')?0x80:0),base,methods:[],fields:[],properties:[]};a.types.push(currentType);expect('{');
      while(!take('}')){
        if(take('.field')){const flags=modifiers(['public','private','static']),fieldType=type(),fieldName=name();const field={token:0x04000000+(++fieldId),name:fieldName,owner:currentType.name,assembly:a.name,type:fieldType,flags:flags.includes('public')?6:1,static:flags.includes('static')};a.fields.push(field);currentType.fields.push(field.token);continue;}
        expect('.method');const start=peek().start,mods=modifiers(['public','private','family','hidebysig','static','instance','virtual','newslot','final','specialname','rtspecialname']),returnType=type(),methodName=name(),params=parameters(true);expect('cil');expect('managed');expect('{');
        if(mods.includes('static')&&mods.includes('instance'))error('Method cannot be both static and instance',start);
        const method={token:0x06000000+(++methodId),name:methodName,owner:currentType.name,assembly:a.name,flags:(mods.includes('public')?6:1)|(mods.includes('static')?16:0)|(mods.includes('virtual')?64:0)|(mods.includes('newslot')?256:0),implFlags:0,static:mods.includes('static'),virtual:mods.includes('virtual'),signature:{hasThis:!mods.includes('static'),explicitThis:false,callingConvention:0,genericArity:0,returnType,parameters:params},body:{code:new Uint8Array(),locals:[],initLocals:true,maxStack:8,offset:start,codeOffset:0,hasExceptionSections:false},instructions:[]};
        const labels=new Map();let offset=0;
        while(!take('}')){
          if(take('.maxstack')){method.body.maxStack=number();continue;}
          if(take('.entrypoint')){a.entryPoint=method.token;continue;}
          if(take('.locals')){method.body.initLocals=take('init');expect('(');while(!take(')')){if(take('[')){if(number()!==method.body.locals.length)error('Locals must have sequential indices');expect(']');}method.body.locals.push(type());if(![')',','].includes(peek().value))name();if(peek().value!==')')expect(',');}continue;}
          if(tokens[cursor+1]?.value===':'){const label=name();expect(':');if(labels.has(label))error('Duplicate IL label '+label);labels.set(label,offset);continue;}
          const token=tokens[cursor++],op=byName.get(token.value);if(!op)error('Unknown IL instruction/directive '+token.value,token.start);let operand=null,n=op.code>255?2:1;
          if(op.operand==='token'){
            n+=4;
            if(op.name==='ldstr'){const t=tokens[cursor++];if(!t.string)error('ldstr expects a quoted string',t.start);operand=0x70000000+(++stringId);a.userStrings[operand]=t.value;}
            else if(['call','callvirt','newobj'].includes(op.name))operand=methodReference();
            else if(['ldfld','ldsfld','stfld','stsfld'].includes(op.name)){const fieldType=type(),owner=typeReference();expect('::');const member={token:0x0a000000+(++memberId),kind:'field',name:name(),owner:owner.name,assembly:owner.assembly,type:fieldType};a.members.push(member);operand=member.token;}
            else {const ref=typeReference();operand=0x01000000+typeRefs.size+1;typeRefs.set(operand,ref);}
          }else if(op.operand.startsWith('branch')){operand=name();n+=op.operand==='branch8'?1:4;}
          else if(op.operand==='switch'){expect('(');operand=[];while(!take(')')){operand.push(name());if(peek().value!==')')expect(',');}n+=4+4*operand.length;}
          else if(op.operand!=='none'){operand=op.operand==='i64'?BigInt(name()):number();n+=({i8:1,u8:1,u16:2,i32:4,i64:8,f32:4,f64:8})[op.operand];}
          if(['i8','u8','u16','i32'].includes(op.operand)){const bounds={i8:[-128,127],u8:[0,255],u16:[0,65535],i32:[-2147483648,2147483647]}[op.operand];if(!Number.isInteger(operand)||operand<bounds[0]||operand>bounds[1])error('IL operand exceeds its encoded integer width',token.start);}
          if(op.operand==='i64'&&(operand<-(1n<<63n)||operand>(1n<<63n)-1n))error('IL operand exceeds signed 64-bit width',token.start);
          if(op.operand==='f32')operand=Math.fround(operand);
          method.instructions.push({offset,name:op.name,operand,next:offset+n,sourceOffset:token.start});offset+=n;
        }
        for(const i of method.instructions){const k=byName.get(i.name).operand;if(k.startsWith('branch')){if(!labels.has(i.operand))error('Unknown branch label '+i.operand,i.sourceOffset);i.operand=labels.get(i.operand);if(k==='branch8'&&(i.operand-i.next < -128||i.operand-i.next > 127))error('Short branch target exceeds signed-byte displacement',i.sourceOffset);}else if(k==='switch')i.operand=i.operand.map(label=>{if(!labels.has(label))error('Unknown switch label '+label,i.sourceOffset);return labels.get(label);});}
        a.methods.push(method);currentType.methods.push(method.token);
      }
    }else error('Expected .assembly, .module, or .class',peek().start);
  }
  a.resolveType=token=>{if(typeRefs.has(token))return typeRefs.get(token);const t=a.types.find(t=>t.token===token);if(!t)throw new BinaryError('Invalid text IL type token');return {name:t.name,assembly:t.assembly};};a.readUserString=token=>{if(!(token in a.userStrings))throw new BinaryError('Invalid user-string token');return a.userStrings[token];};a.source=source;return a;
}
