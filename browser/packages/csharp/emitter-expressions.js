import {failure} from '../core/index.js';
import {Parser} from './parser.js';
import {EmitterCore,defaultValue} from './emitter-core.js';

export class ExpressionEmitter extends EmitterCore {
  expr(n,s){
    if(!n)return 'null';
    switch(n.kind){
      case'literal':return JSON.stringify(n.value);
      case'name':return this.name(n,s);
      case'member':{const path=this.path(n),type=this.resolveType(path);if(type)return type;
        if(n.object.kind==='name'&&n.object.name==='base')return `super.${n.name}`;
        return `R.get(${this.expr(n.object,s)},${JSON.stringify(n.name)},${!!n.optional})`;}
      case'index':return `R.dotnet.index(${this.expr(n.object,s)},${this.expr(n.index,s)})`;
      case'call':{
        if(n.callee.kind==='name'&&n.callee.name==='nameof')return JSON.stringify(this.path(n.args[0])?.split('.').at(-1)||'');
        if(n.callee.kind==='member'&&n.callee.object.kind==='name'&&n.callee.object.name==='base')return `super.${n.callee.name}(${n.args.map(x=>this.expr(x,s)).join(',')})`;
        if(n.callee.kind==='member')return `R.call(${this.expr(n.callee.object,s)},${JSON.stringify(n.callee.name)},[${n.args.map(x=>this.expr(x,s)).join(',')}],${!!n.callee.optional})`;
        return `(${this.expr(n.callee,s)})(${n.args.map(x=>this.expr(x,s)).join(',')})`;
      }
      case'binary':{
        const a=this.expr(n.left,s),b=this.expr(n.right,s),op=n.op==='=='?'===':n.op==='!='?'!==':n.op;
        if(this.inferred(n,s)==='int'&&['+','-','*','/'].includes(op))return op==='/'?`R.dotnet.idiv(${a},${b})`:op==='*'?`Math.imul(${a},${b})`:`((${a}${op}${b})|0)`;
        return `(${a} ${op} ${b})`;
      }
      case'assignment':{
        const rhs=this.expr(n.right,s);
        if(n.left.kind==='index')return `R.dotnet.${n.op==='='?'setIndex':'updateIndex'}(${this.expr(n.left.object,s)},${this.expr(n.left.index,s)},${n.op==='='?'':JSON.stringify(n.op.slice(0,-1))+','}${rhs})`;
        if(['+=','-='].includes(n.op)&&n.left.kind==='name'&&this.member(n.left.name)?.kind==='event')return `R.${n.op==='+='?'addEvent':'removeEvent'}(this,${JSON.stringify(n.left.name)},${rhs})`;
        if(['+=','-='].includes(n.op)&&n.left.kind==='member'&&['Click','Checked','Unchecked','TextChanged','ValueChanged','SelectionChanged','PropertyChanged'].includes(n.left.name))return `R.${n.op==='+='?'addEvent':'removeEvent'}(${this.expr(n.left.object,s)},${JSON.stringify(n.left.name)},${rhs})`;
        return `(${this.lvalue(n.left,s)} ${n.op} ${rhs})`;
      }
      case'unary':return ['++','--'].includes(n.op)?`(${n.op}${this.lvalue(n.value,s)})`:`(${n.op==='await'?'await ':n.op}${this.expr(n.value,s)})`;
      case'postfix':return `(${this.lvalue(n.value,s)}${n.op})`;
      case'conditional':return `(${this.expr(n.condition,s)}?${this.expr(n.yes,s)}:${this.expr(n.no,s)})`;
      case'nulltest':return `(${this.expr(n.value,s)}${n.not?'!=':'=='}null)`;
      case'typetest':return n.as?`R.dotnet.as(${this.expr(n.value,s)},${this.type(n.type)})`:`(${n.not?'!':''}R.dotnet.is(${this.expr(n.value,s)},${this.type(n.type)}))`;
      case'cast':return `R.dotnet.cast(${this.expr(n.value,s)},${JSON.stringify(n.type.name)})`;
      case'default':return defaultValue(n.type);
      case'typeof':return this.type(n.type);
      case'array':return `[${n.values.map(x=>this.expr(x,s)).join(',')}]`;
      case'new':{
        if(n.size)return `new Array(${this.expr(n.size,s)}).fill(${defaultValue(n.type)})`;
        if(n.type.arrays)return `[${n.initializer.map(x=>this.expr(x.value,s)).join(',')}]`;
        const construct=`new (${this.type(n.type)})(${n.args.map(x=>this.expr(x,s)).join(',')})`;
        if(!n.initializer.length)return construct;
        if(n.initializer.every(x=>x.name))return `Object.assign(${construct},{${n.initializer.map(x=>`${JSON.stringify(x.name)}:${this.expr(x.value,s)}`).join(',')}})`;
        if(n.initializer.some(x=>x.name)){this.report('JB2014','Mixed object and collection initializer',n);return construct;}
        return `R.dotnet.initializeCollection(${construct},[${n.initializer.map(x=>this.expr(x.value,s)).join(',')}])`;
      }
      case'lambda':{const inner=this.scope(s);n.params.forEach(p=>inner.set(p.name,p.type||{name:'object'}));const body=n.body.kind==='block'?this.block(n.body,inner):this.expr(n.body,inner);return `(${n.async?'async ':''}(${n.params.map(p=>p.name).join(',')})=>${body})`;}
      case'interpolated':return this.interpolation(n,s);
      default:this.report('JB2015',`No emitter for ${n.kind}`,n);return 'undefined';
    }
  }
  interpolation(n,s){
    const chunks=[];let text='',i=0;const v=n.value;const flush=()=>{if(text){chunks.push(JSON.stringify(text));text='';}};
    while(i<v.length){if(v.startsWith('{{',i)){text+='{';i+=2;continue;}if(v.startsWith('}}',i)){text+='}';i+=2;continue;}if(v[i]!=='{'){text+=v[i++];continue;}
      flush();const start=++i;let depth=1,quote='';while(i<v.length&&depth){const c=v[i];if(quote){if(c===quote&&v[i-1]!=='\\')quote='';}else if(c==='"'||c==="'")quote=c;else if(c==='{')depth++;else if(c==='}')depth--;if(depth)i++;}
      if(depth){this.report('JB2016','Unclosed interpolation',n);break;}
      let raw=v.slice(start,i++),format='';const colon=raw.lastIndexOf(':');if(colon>=0&&!raw.includes('?')){format=raw.slice(colon+1);raw=raw.slice(0,colon);}
      try{const p=new Parser(raw,{file:this.current?.file});const expression=p.expression();p.expect('<eof>');chunks.push(`R.dotnet.format(${this.expr(expression,s)},${JSON.stringify(format)})`);}catch(e){this.diagnostics.push(failure(e,this.current?.file));}
    }
    flush();return `(${chunks.length?chunks.join(' + '):'""'})`;
  }
}
