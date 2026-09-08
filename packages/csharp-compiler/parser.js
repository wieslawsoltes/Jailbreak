import { CompileError, DiagnosticBag } from '../compiler-core/index.js';
import { lexCSharp } from './lexer.js';
const modifiers=new Set('public private protected internal static abstract virtual override sealed partial readonly const async extern new required volatile'.split(' '));
const precedence={'=':1,'+=':1,'-=':1,'*=':1,'/=':1,'%=':1,'??=':1,'&=':1,'|=':1,'^=':1,'??':3,'||':4,'&&':5,'|':6,'^':7,'&':8,'==':9,'!=':9,'is':9,'as':9,'<':10,'>':10,'<=':10,'>=':10,'<<':11,'>>':11,'+':12,'-':12,'*':13,'/':13,'%':13};
export class CSharpParser {
  constructor(tokens){this.tokens=tokens;this.i=0;}
  get t(){return this.tokens[this.i];}
  at(value){return this.t.value===value;}
  next(){return this.tokens[this.i++];}
  take(value){if(this.at(value)){this.i++;return true;}return false;}
  expect(value){if(!this.take(value))this.fail(`Expected '${value}', found '${this.t.value}'`);}
  fail(message,token=this.t,code='JB2101'){throw new CompileError(code,message,token.start);}
  id(){if(this.t.kind!=='id')this.fail('Expected identifier');return this.next().value;}
  node(kind,start,props={}){return {kind,start,end:this.tokens[Math.max(0,this.i-1)].end,...props};}
  qualified(){let s=this.id();while(this.take('.'))s+='.'+this.id();return s;}
  attributes(){const a=[];while(this.take('[')){let depth=1,text='';while(depth&&this.t.kind!=='eof'){const t=this.next();if(t.value==='[')depth++;if(t.value===']')depth--;if(depth)text+=t.value+' ';}a.push(text.trim());}return a;}
  mods(){const m=[];while(modifiers.has(this.t.value))m.push(this.next().value);return m;}
  type(){
    const start=this.t.start;let name=this.id(),args=[];
    if(this.take('::'))name=this.id();
    while(this.take('.'))name+='.'+this.id();
    if(this.take('<')){do{args.push(this.type());}while(this.take(','));this.closeGeneric();}
    const nullable=this.take('?');let rank=0;
    while(this.at('[')&&this.tokens[this.i+1]?.value===']'){this.i+=2;rank++;}
    return this.node('type',start,{name,args,nullable,rank});
  }
  closeGeneric(){if(this.at('>>')){const t=this.t;this.tokens.splice(this.i,1,{...t,value:'>',end:t.start+1},{...t,value:'>',start:t.start+1});}this.expect('>');}
  typeParameters(){const result=[];if(this.take('<')){do{result.push(this.id());}while(this.take(','));this.closeGeneric();}return result;}
  compilation(){const declarations=[],usings=[];this.declarations('',declarations,usings);return {kind:'compilation',declarations,usings};}
  declarations(ns,out,usings,end=null){
    while(this.t.kind!=='eof'&&(!end||!this.at(end))){
      if(this.take(';'))continue;
      if(this.take('global'))this.expect('using');else if(this.take('using')){}else {
        if(this.take('namespace')){const name=this.qualified(),full=ns?ns+'.'+name:name;if(this.take(';')){this.declarations(full,out,usings,end);return;}this.expect('{');this.declarations(full,out,usings,'}');this.expect('}');continue;}
        const attrs=this.attributes(),mods=this.mods();out.push(this.declaration(ns,mods,attrs));continue;
      }
      if(this.at('static'))this.fail('using static is not implemented',this.t,'JB2110');
      const name=this.qualified();if(this.take('=')){usings.push({alias:name,name:this.qualified()});}else usings.push({name});this.expect(';');
    }
  }
  declaration(ns,mods,attributes){
    const start=this.t.start,kind=this.next().value;
    if(!['class','interface','enum'].includes(kind))this.fail(`Unsupported declaration '${kind}'`,{start},'JB2111');
    const name=this.id(),fullName=ns?ns+'.'+name:name,generics=this.typeParameters();const bases=[];
    if(this.take(':')){do{bases.push(this.type());}while(this.take(','));}
    if(this.at('where'))this.fail('Generic constraints require the extended type checker',this.t,'JB2112');
    this.expect('{');const members=[];
    if(kind==='enum'){
      while(!this.at('}')&&this.t.kind!=='eof'){const m={name:this.id(),value:null};if(this.take('='))m.value=this.expression(2);members.push(m);if(!this.take(','))break;}
    } else {
      while(!this.at('}')&&this.t.kind!=='eof'){if(this.take(';'))continue;const attrs=this.attributes(),m=this.mods();members.push(...this.member(name,m,attrs,kind==='interface'));}
    }
    this.expect('}');this.take(';');return this.node(kind,start,{name,fullName,namespace:ns,generics,bases,mods,attributes,members});
  }
  parameters(){
    this.expect('(');const result=[];
    if(!this.at(')'))do {
      const start=this.t.start;const attrs=this.attributes();let rest=this.take('params');
      if(['ref','out','in','this'].includes(this.t.value))this.fail(`Parameter modifier '${this.t.value}' is not implemented`,this.t,'JB2113');
      const type=this.type(),name=this.id(),value=this.take('=')?this.expression(2):null;result.push({name,type,value,rest,attributes:attrs,start});
    }while(this.take(','));
    this.expect(')');return result;
  }
  methodBody(){if(this.take(';'))return null;if(this.take('=>')){const expr=this.expression();this.expect(';');return {kind:'expressionBody',expression:expr,start:expr.start};}return this.block();}
  member(className,mods,attributes,isInterface){
    const start=this.t.start,event=this.take('event');
    if(this.at(className)&&this.tokens[this.i+1]?.value==='('){
      this.next();const parameters=this.parameters();let initializer=null;
      if(this.take(':')){const target=this.next().value;if(target!=='base')this.fail('Delegating this(...) constructors are not implemented',this.tokens[this.i-1],'JB2114');initializer={target,args:this.arguments()};}
      return [this.node('constructor',start,{name:className,mods,attributes,parameters,initializer,body:this.block()})];
    }
    const type=this.type(),name=this.id(),generics=this.typeParameters();
    if(this.at('('))return [this.node('method',start,{name,type,mods,attributes,generics,parameters:this.parameters(),body:this.methodBody()})];
    if(this.take('=>')){const expression=this.expression();this.expect(';');return [this.node('property',start,{name,type,mods,attributes,get:{kind:'expressionBody',expression},set:null,init:null})];}
    if(this.take('{')){
      if(event)this.fail('Custom event accessors are not implemented',{start},'JB2115');
      const accessors={get:null,set:null};
      while(!this.at('}')&&this.t.kind!=='eof'){
        this.mods();let key=this.next().value;if(key==='init')key='set';
        if(key!=='get'&&key!=='set')this.fail(`Unsupported property accessor '${key}'`);
        accessors[key]=this.take(';')?{kind:'auto'}:this.take('=>')?{kind:'expressionBody',expression:this.expression()}:this.block();
        if(accessors[key].kind==='expressionBody')this.expect(';');
      }
      this.expect('}');const init=this.take('=')?this.expression(2):null;if(init)this.expect(';');
      return [this.node('property',start,{name,type,mods,attributes,...accessors,init})];
    }
    const out=[];let field=name;
    do {const init=this.take('=')?this.expression(2):null;out.push(this.node(event?'event':'field',start,{name:field,type,mods,attributes,init}));if(!this.take(','))break;field=this.id();}while(true);
    this.expect(';');return out;
  }
  block(){const start=this.t.start;this.expect('{');const statements=[];while(!this.at('}')&&this.t.kind!=='eof')statements.push(this.statement());this.expect('}');return this.node('block',start,{statements});}
  declarationStatement(consume=true){
    const start=this.t.start;this.take('const');const type=this.type(),variables=[];
    do {const name=this.id(),init=this.take('=')?this.expression(2):null;variables.push({name,init});}while(this.take(','));
    if(consume)this.expect(';');return this.node('local',start,{type,variables});
  }
  isLocal(){const save=this.i;try{this.take('const');this.type();if(this.t.kind!=='id')return false;this.next();return ['=',',',';',')','in'].includes(this.t.value);}catch{return false;}finally{this.i=save;}}
  statement(){
    const start=this.t.start;
    if(this.at('{'))return this.block();if(this.take(';'))return this.node('empty',start);
    if(this.take('if')){this.expect('(');const test=this.expression();this.expect(')');const consequent=this.statement(),alternate=this.take('else')?this.statement():null;return this.node('if',start,{test,consequent,alternate});}
    if(this.take('return')||this.take('throw')){const kind=this.tokens[this.i-1].value;const expression=this.at(';')?null:this.expression();this.expect(';');return this.node(kind,start,{expression});}
    if(this.take('break')||this.take('continue')){const kind=this.tokens[this.i-1].value;this.expect(';');return this.node(kind,start);}
    if(this.take('while')){this.expect('(');const test=this.expression();this.expect(')');return this.node('while',start,{test,body:this.statement()});}
    if(this.take('do')){const body=this.statement();this.expect('while');this.expect('(');const test=this.expression();this.expect(')');this.expect(';');return this.node('do',start,{test,body});}
    if(this.take('for')){this.expect('(');const init=this.at(';')?null:this.isLocal()?this.declarationStatement(false):this.expression();this.expect(';');const test=this.at(';')?null:this.expression();this.expect(';');const update=this.at(')')?null:this.expression();this.expect(')');return this.node('for',start,{init,test,update,body:this.statement()});}
    if(this.take('foreach')){this.expect('(');const type=this.type(),name=this.id();this.expect('in');const iterable=this.expression();this.expect(')');return this.node('foreach',start,{type,name,iterable,body:this.statement()});}
    if(this.take('try')){const body=this.block(),catches=[];while(this.take('catch')){let type=null,name='__error';if(this.take('(')){type=this.type();if(this.t.kind==='id')name=this.id();this.expect(')');}if(this.at('when'))this.fail('Catch filters are not implemented',this.t,'JB2116');catches.push({type,name,body:this.block()});}const finalizer=this.take('finally')?this.block():null;if(!catches.length&&!finalizer)this.fail('try requires catch or finally');return this.node('try',start,{body,catches,finalizer});}
    if(this.take('switch')){this.expect('(');const expression=this.expression();this.expect(')');this.expect('{');const cases=[];while(!this.at('}')&&this.t.kind!=='eof'){let value=null;if(this.take('case'))value=this.expression(2);else this.expect('default');this.expect(':');const statements=[];while(!['case','default','}','<eof>'].includes(this.t.value))statements.push(this.statement());cases.push({value,statements});}this.expect('}');return this.node('switch',start,{expression,cases});}
    if(['using','lock','yield','unsafe','fixed','goto','checked','unchecked'].includes(this.t.value))this.fail(`Statement '${this.t.value}' is not in the supported profile`,this.t,'JB2117');
    if(this.isLocal())return this.declarationStatement();
    const expression=this.expression();this.expect(';');return this.node('expressionStatement',start,{expression});
  }
  arguments(){this.expect('(');const args=[];if(!this.at(')'))do{if(['ref','out','in'].includes(this.t.value))this.fail('By-reference arguments are not implemented',this.t,'JB2118');args.push(this.expression(2));}while(this.take(','));this.expect(')');return args;}
  expression(min=1){
    let left=this.prefix();left=this.postfix(left);
    while(true){
      if(this.at('?')&&min<=2){this.next();const consequent=this.expression();this.expect(':');const alternate=this.expression(2);left=this.node('conditional',left.start,{test:left,consequent,alternate});continue;}
      const op=this.t.value,p=precedence[op];if(p===undefined||p<min)break;this.next();
      if(op==='is'||op==='as'){let right;if(this.take('null'))right={kind:'literal',value:null};else right=this.type();left=this.node('typeTest',left.start,{left,op,type:right});continue;}
      const right=this.expression(p+(p===1||op==='??'?0:1));left=this.node(p===1?'assignment':'binary',left.start,{left,op,right});
    }
    return left;
  }
  prefix(){
    const t=this.next(),start=t.start;
    if(['!','~','+','-','++','--','await'].includes(t.value))return this.node('unary',start,{op:t.value,argument:this.expression(14)});
    if(t.value==='new'){
      let type=null,args=[],items=null,members=null,length=null;
      if(this.at('[')){this.next();this.expect(']');type={name:'var',args:[],rank:1};}
      else if(!this.at('(')&&!this.at('{'))type=this.type();
      if(this.at('('))args=this.arguments();
      if(this.take('[')){length=this.expression();this.expect(']');type.rank=(type.rank??0)+1;}
      if(this.take('{')){
        items=[];members=[];
        while(!this.at('}')&&this.t.kind!=='eof'){
          if(this.t.kind==='id'&&this.tokens[this.i+1]?.value==='='){const key=this.next().value;this.next();members.push({name:key,value:this.expression(2)});}
          else if(this.take('{')){const pair=[];do{pair.push(this.expression(2));}while(this.take(','));this.expect('}');items.push({kind:'initializerPair',items:pair,start});}
          else items.push(this.expression(2));
          if(!this.take(','))break;
        }
        this.expect('}');
      }
      return this.node('new',start,{type,args,items,members,length});
    }
    if(t.value==='typeof'||t.value==='default'){if(this.take('(')){const type=this.type();this.expect(')');return this.node(t.value,start,{type});}return this.node('default',start,{type:null});}
    if(t.value==='nameof'){this.expect('(');const expression=this.expression();this.expect(')');return this.node('nameof',start,{expression});}
    if(t.value==='('){
      const save=this.i;let depth=1,j=this.i;while(j<this.tokens.length&&depth){if(this.tokens[j].value==='(')depth++;if(this.tokens[j].value===')')depth--;j++;}
      if(this.tokens[j]?.value==='=>'){
        const parameters=[];
        if(!this.at(')'))do{let type=null,name;if(this.t.kind==='id'&&[',',')'].includes(this.tokens[this.i+1]?.value))name=this.id();else {type=this.type();name=this.id();}parameters.push({name,type});}while(this.take(','));
        this.expect(')');this.expect('=>');return this.node('lambda',start,{parameters,body:this.at('{')?this.block():this.expression(2)});
      }
      try {const type=this.type();if(this.take(')')&&['id','number','string','char'].includes(this.t.kind)&&!['is','as'].includes(this.t.value))return this.node('cast',start,{type,expression:this.expression(14)});}catch{}this.i=save;
      const expression=this.expression();this.expect(')');return this.node('group',start,{expression});
    }
    if(t.kind==='number')return this.node('literal',start,{value:Number(t.value),numericType:t.numericType});
    if(t.kind==='string'||t.kind==='char')return this.node('literal',start,{value:t.value});
    if(t.kind==='interpolated')return this.node('interpolated',start,{value:t.value});
    if(['true','false','null'].includes(t.value))return this.node('literal',start,{value:t.value==='null'?null:t.value==='true'});
    if(t.kind==='id'){
      if(this.take('=>'))return this.node('lambda',start,{parameters:[{name:t.value,type:null}],body:this.at('{')?this.block():this.expression(2)});
      return this.node('identifier',start,{name:t.value});
    }
    this.fail(`Expected expression, found '${t.value}'`,t);
  }
  postfix(left){
    while(true){
      if(this.take('.')||this.take('?.')){const optional=this.tokens[this.i-1].value==='?.';const name=this.id();left=this.node('member',left.start,{object:left,name,optional});continue;}
      if(this.at('<')){const save=this.i;try{this.next();const args=[];do{args.push(this.type());}while(this.take(','));this.closeGeneric();if(this.at('(')){left={...left,typeArguments:args};continue;}}catch{}this.i=save;}
      if(this.at('(')){left=this.node('call',left.start,{callee:left,args:this.arguments()});continue;}
      if(this.take('[')||this.take('?[')){const optional=this.tokens[this.i-1].value==='?[';const index=this.expression();this.expect(']');left=this.node('index',left.start,{object:left,index,optional});continue;}
      if(this.take('++')||this.take('--')){left=this.node('postfix',left.start,{op:this.tokens[this.i-1].value,argument:left});continue;}
      if(this.take('!')){left=this.node('nullForgiving',left.start,{expression:left});continue;}
      break;
    }
    return left;
  }
}
export function parseCSharp(text,path='program.cs') {
  const lexed=lexCSharp(text,path),bag=new DiagnosticBag();bag.merge(lexed.diagnostics);let ast=null;
  if(!bag.hasErrors)try{ast=new CSharpParser(lexed.tokens).compilation();}catch(e){if(!(e instanceof CompileError))throw e;bag.add(e.code,e.message,lexed.source,e.offset);}
  return {ast,source:lexed.source,tokens:lexed.tokens,diagnostics:bag.items};
}
export function parseExpression(text){const lexed=lexCSharp(text);if(lexed.diagnostics.length)throw new Error(lexed.diagnostics[0].message);const parser=new CSharpParser(lexed.tokens);const expr=parser.expression();if(parser.t.kind!=='eof')throw new Error('Unexpected interpolation expression suffix');return expr;}
