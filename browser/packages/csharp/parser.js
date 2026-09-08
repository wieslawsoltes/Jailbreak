import {CompileError} from '../core/index.js';
import {tokenize,modifiers,primitive,unsupported} from './lexer.js';

const precedence={'=':1,'+=':1,'-=':1,'*=':1,'/=':1,'%=':1,'??=':1,'&=':1,'|=':1,'^=':1,'??':3,'||':4,'&&':5,'|':6,'^':7,'&':8,'==':9,'!=':9,'<':10,'>':10,'<=':10,'>=':10,'is':10,'as':10,'+':12,'-':12,'*':13,'/':13,'%':13};

export class Parser {
  constructor(source,{file='source.cs'}={}){this.source=source;this.file=file;this.tokens=tokenize(source,file);this.i=0;this.usings=[];}
  peek(n=0){return this.tokens[Math.min(this.i+n,this.tokens.length-1)];}
  at(v){return this.peek().value===v;}
  next(){return this.tokens[this.i++];}
  take(v){if(this.at(v)){this.i++;return true;}return false;}
  expect(v){const t=this.next();if(t?.value!==v)this.error(`Expected ${v}, found ${t?.value}`,t);return t;}
  id(){const t=this.next();if(t?.kind!=='id')this.error('Expected identifier',t);return t.value;}
  error(message,t=this.peek()){throw new CompileError('JB2002',message,this.source,t?.offset||0,this.file);}
  type(){
    const start=this.peek(),parts=[this.id()];
    while(this.take('.'))parts.push(this.id());
    const args=[];if(this.take('<')){do{args.push(this.type());}while(this.take(','));this.expect('>');}
    let nullable=this.take('?'),arrays=0;while(this.at('[')&&this.peek(1).value===']'){this.i+=2;arrays++;}
    if(['long','ulong','decimal','dynamic','uint'].includes(parts.join('.')))this.error(`${parts.join('.')} requires an additional semantic/runtime lowering`,start);
    return {name:parts.join('.'),args,nullable,arrays,loc:start};
  }
  program(){const classes=[],enums=[];this.declarations('',classes,enums);return {kind:'program',classes,enums,usings:this.usings,file:this.file};}
  declarations(namespace,classes,enums){
    while(!this.at('<eof>')&&!this.at('}')){
      if(this.take('using')){if(this.at('static'))this.error('using static is not implemented');const parts=[this.id()];while(this.take('.'))parts.push(this.id());if(this.at('='))this.error('using aliases are not implemented');this.expect(';');this.usings.push(parts.join('.'));continue;}
      if(this.take('namespace')){const parts=[this.id()];while(this.take('.'))parts.push(this.id());const ns=[namespace,parts.join('.')].filter(Boolean).join('.');if(this.take(';')){this.declarations(ns,classes,enums);return;}this.expect('{');this.declarations(ns,classes,enums);this.expect('}');continue;}
      const mods=this.mods();
      if(this.at('['))this.error('Attributes and source generators require an explicit extension');
      if(this.take('enum')){const name=this.id();this.expect('{');const values=[];let value=0;while(!this.at('}')){const key=this.id();if(this.take('=')){const sign=this.take('-')?-1:1;const t=this.next();if(t.kind!=='number')this.error('Enum values must be integral constants',t);value=sign*t.value;}values.push([key,value++]);if(!this.take(','))break;}this.expect('}');this.take(';');enums.push({name,fullName:[namespace,name].filter(Boolean).join('.'),values});continue;}
      if(!this.take('class'))this.error(`Unsupported declaration ${this.peek().value}; expected class or enum`);
      const name=this.id();if(this.at('<'))this.error('Generic class declarations require reified-type/constraint lowering');
      const fullName=[namespace,name].filter(Boolean).join('.'),bases=[];if(this.take(':')){do{bases.push(this.type());}while(this.take(','));}
      this.expect('{');const members=[];
      while(!this.at('}')){if(this.at('<eof>'))this.error(`Unclosed class ${name}`);members.push(...this.member(name));}
      this.expect('}');this.take(';');classes.push({kind:'class',name,fullName,namespace,mods,bases,members,usings:[...this.usings],file:this.file});
    }
  }
  mods(){const a=[];while(modifiers.has(this.peek().value))a.push(this.next().value);return a;}
  parameters(){
    this.expect('(');const out=[];if(!this.at(')'))do{
      if(['ref','out','in','params','this'].includes(this.peek().value))this.error('By-reference, params and extension parameters are not implemented');
      const type=this.type(),name=this.id();let initial=null;if(this.take('='))initial=this.expression(2);out.push({type,name,initial});
    }while(this.take(','));this.expect(')');return out;
  }
  member(className){
    const start=this.peek(),mods=this.mods();
    if(this.at('['))this.error('Attributes/source-generated members are not implemented');
    if(unsupported.has(this.peek().value))this.error(`Unsupported member feature ${this.peek().value}`);
    if(this.at(className)&&this.peek(1).value==='('){
      this.next();const params=this.parameters();let baseArgs=[];
      if(this.take(':')){if(!this.take('base'))this.error('this-constructor chaining is not implemented');baseArgs=this.arguments();}
      return [{kind:'constructor',name:className,mods,params,baseArgs,body:this.block(),loc:start}];
    }
    const isEvent=this.take('event'),type=this.type(),name=this.id();
    if(this.at('<'))this.error('Generic method declarations require a lowering extension');
    if(this.at('(')){
      const params=this.parameters();let body;
      if(this.take('=>')){body={kind:'block',statements:[{kind:'return',value:this.expression()}]};this.expect(';');}
      else if(this.take(';'))this.error('Abstract/extern method declarations cannot be executed');else body=this.block();
      return [{kind:'method',name,type,params,body,mods,loc:start}];
    }
    if(this.at('{')||this.at('=>')){
      if(this.take('=>')){const expression=this.expression();this.expect(';');return [{kind:'property',name,type,mods,get:{kind:'block',statements:[{kind:'return',value:expression}]},set:null,auto:false,loc:start}];}
      this.expect('{');let get=null,set=null,auto=true;
      while(!this.at('}')){this.mods();const access=this.next();if(!['get','set'].includes(access.value))this.error('Only get/set property accessors are implemented',access);
        let body=true;if(this.take(';')){}else if(this.take('=>')){const value=this.expression();this.expect(';');body={kind:'block',statements:[{kind:access.value==='get'?'return':'expression',value}]};auto=false;}else {body=this.block();auto=false;}
        if(access.value==='get')get=body;else set=body;
      }
      this.expect('}');let initial=null;if(this.take('=')){initial=this.expression();this.expect(';');}
      return [{kind:'property',name,type,mods,get,set,auto,initial,loc:start}];
    }
    const result=[];let current=name;
    do{let initial=null;if(this.take('='))initial=this.expression(2);result.push({kind:isEvent?'event':'field',name:current,type,mods,initial,loc:start});if(!this.take(','))break;current=this.id();}while(true);
    this.expect(';');return result;
  }
  block(){this.expect('{');const statements=[];while(!this.at('}')){if(this.at('<eof>'))this.error('Unclosed statement block');statements.push(this.statement());}this.expect('}');return {kind:'block',statements};}
  tryLocal(consumeSemicolon=true){
    const saved=this.i;let type,name;
    try{type=this.type();if(this.peek().kind!=='id'){this.i=saved;return null;}name=this.id();if(!['=',',',';'].includes(this.peek().value)){this.i=saved;return null;}}catch{this.i=saved;return null;}
    const declarations=[];do{const initial=this.take('=')?this.expression(2):null;declarations.push({name,type,initial});if(!this.take(','))break;name=this.id();}while(true);
    if(consumeSemicolon)this.expect(';');return {kind:'local',declarations};
  }
  statement(){
    if(this.at('{'))return this.block();if(this.take(';'))return {kind:'empty'};
    const t=this.peek();if(unsupported.has(t.value))this.error(`Unsupported statement ${t.value}`,t);
    if(this.take('if')){this.expect('(');const condition=this.expression();this.expect(')');const then=this.statement(),otherwise=this.take('else')?this.statement():null;return {kind:'if',condition,then,otherwise};}
    if(this.take('while')){this.expect('(');const condition=this.expression();this.expect(')');return {kind:'while',condition,body:this.statement()};}
    if(this.take('do')){const body=this.statement();this.expect('while');this.expect('(');const condition=this.expression();this.expect(')');this.expect(';');return {kind:'do',condition,body};}
    if(this.take('foreach')){this.expect('(');const type=this.type(),name=this.id();this.expect('in');const iterable=this.expression();this.expect(')');return {kind:'foreach',type,name,iterable,body:this.statement()};}
    if(this.take('for')){
      this.expect('(');let init=null;if(!this.at(';'))init=this.tryLocal(false)||{kind:'expression',value:this.expression()};this.expect(';');const condition=this.at(';')?null:this.expression();this.expect(';');const increments=[];if(!this.at(')'))do{increments.push(this.expression());}while(this.take(','));this.expect(')');return {kind:'for',init,condition,increments,body:this.statement()};
    }
    if(this.take('return')){const value=this.at(';')?null:this.expression();this.expect(';');return {kind:'return',value};}
    if(this.take('throw')){const value=this.at(';')?null:this.expression();this.expect(';');return {kind:'throw',value};}
    if(this.take('break')){this.expect(';');return {kind:'break'};}if(this.take('continue')){this.expect(';');return {kind:'continue'};}
    if(this.take('try')){const body=this.block(),catches=[];while(this.take('catch')){let type=null,name='$exception';if(this.take('(')){type=this.type();if(!this.at(')'))name=this.id();this.expect(')');}if(this.at('when'))this.error('Catch filters are not implemented');catches.push({type,name,body:this.block()});}const finalizer=this.take('finally')?this.block():null;if(!catches.length&&!finalizer)this.error('try needs catch or finally');return {kind:'try',body,catches,finalizer};}
    if(this.take('switch')){this.expect('(');const value=this.expression();this.expect(')');this.expect('{');const sections=[];while(!this.at('}')){const labels=[];while(this.at('case')||this.at('default')){if(this.take('case'))labels.push(this.expression());else{this.expect('default');labels.push(null);}this.expect(':');}if(!labels.length)this.error('Expected case or default');const statements=[];while(!this.at('case')&&!this.at('default')&&!this.at('}'))statements.push(this.statement());sections.push({labels,statements});}this.expect('}');return {kind:'switch',value,sections};}
    if(this.take('using')){this.error('using statements/declarations require deterministic disposal lowering');}
    const local=this.tryLocal();if(local)return local;
    const value=this.expression();this.expect(';');return {kind:'expression',value};
  }
  arguments(){this.expect('(');const args=[];if(!this.at(')'))do{if(this.peek(1).value===':')this.error('Named arguments need parameter binding before emission');args.push(this.expression(2));}while(this.take(','));this.expect(')');return args;}
  expression(min=0){
    let left=this.prefix();
    while(true){
      const t=this.peek(),op=t.value;
      if(op==='?'&&min<=2){this.next();const yes=this.expression();this.expect(':');const no=this.expression(2);left={kind:'conditional',condition:left,yes,no,loc:t};continue;}
      const p=precedence[op];if(p===undefined||p<min)break;this.next();
      if(op==='is'||op==='as'){const not=this.take('not');if(this.take('null'))left={kind:'nulltest',value:left,not,loc:t};else{const type=this.type();left={kind:'typetest',value:left,type,as:op==='as',not,loc:t};}continue;}
      const right=this.expression(p+(p===1||op==='??'?0:1));left={kind:p===1?'assignment':'binary',op,left,right,loc:t};
    }
    return left;
  }
  prefix(){
    const t=this.peek();let node;
    if(['!','~','+','-','++','--','await'].includes(t.value)){this.next();return {kind:'unary',op:t.value,value:this.expression(14),loc:t};}
    if(t.value==='async'){this.next();node=this.prefix();if(node.kind!=='lambda')this.error('async is supported only on methods/lambdas',t);node.async=true;return node;}
    if(t.kind==='number'||t.kind==='string'){this.next();node={kind:'literal',value:t.value,type:t.kind==='number'?t.numericType:(t.char?'char':'string'),loc:t};}
    else if(t.kind==='interpolated'){this.next();node={kind:'interpolated',value:t.value,loc:t};}
    else if(['true','false','null'].includes(t.value)){this.next();node={kind:'literal',value:t.value==='null'?null:t.value==='true',type:t.value==='null'?'object':'bool',loc:t};}
    else if(this.take('new')){
      if(this.take('[')){this.expect(']');this.expect('{');const values=[];if(!this.at('}'))do{values.push(this.expression(2));}while(this.take(',')&&!this.at('}'));this.expect('}');node={kind:'array',values,loc:t};}
      else {
        const type=this.type();let size=null,args=[];if(this.take('[')){size=this.expression();this.expect(']');}else if(this.at('('))args=this.arguments();
        let initializer=[];if(this.take('{')){while(!this.at('}')){if(this.peek().kind==='id'&&this.peek(1).value==='='){const name=this.id();this.expect('=');initializer.push({name,value:this.expression(2)});}else initializer.push({value:this.expression(2)});if(!this.take(','))break;}this.expect('}');}
        node={kind:'new',type,args,size,initializer,loc:t};
      }
    }
    else if(this.take('(')){
      const start=this.i;let isLambda=false,params=[];
      try{if(!this.at(')'))do{const pos=this.i;let type=null,name=this.id();if(this.peek().kind==='id'){this.i=pos;type=this.type();name=this.id();}params.push({name,type});}while(this.take(','));this.expect(')');isLambda=this.take('=>');}catch{isLambda=false;}
      if(isLambda)node={kind:'lambda',params,body:this.at('{')?this.block():this.expression(2),loc:t};
      else {
        this.i=start;let castType=null;
        if(primitive.has(this.peek().value)&&this.peek().value!=='var'){try{castType=this.type();this.expect(')');}catch{this.i=start;castType=null;}}
        if(castType)node={kind:'cast',type:castType,value:this.expression(14),loc:t};else{node=this.expression();this.expect(')');}
      }
    }
    else if(t.kind==='id'){
      this.next();if(this.take('=>'))node={kind:'lambda',params:[{name:t.value}],body:this.at('{')?this.block():this.expression(2),loc:t};
      else if(t.value==='typeof'||t.value==='default'){this.expect('(');const type=this.type();this.expect(')');node={kind:t.value,type,loc:t};}
      else node={kind:'name',name:t.value,loc:t};
    }
    else this.error(`Unsupported or missing expression at ${t.value}`,t);
    while(true){
      if(this.at('.')||this.at('?.')){const optional=this.next().value==='?.';const name=this.id();node={kind:'member',object:node,name,optional,loc:t};continue;}
      if(this.at('<')){const saved=this.i;try{this.next();const genericArgs=[];do{genericArgs.push(this.type());}while(this.take(','));this.expect('>');if(!this.at('('))throw new Error();node={...node,genericArgs};}catch{this.i=saved;}if(this.i!==saved)continue;}
      if(this.at('(')){node={kind:'call',callee:node,args:this.arguments(),loc:t};continue;}
      if(this.take('[')){const index=this.expression();this.expect(']');node={kind:'index',object:node,index,loc:t};continue;}
      if(this.at('++')||this.at('--')){node={kind:'postfix',op:this.next().value,value:node,loc:t};continue;}break;
    }
    return node;
  }
}

