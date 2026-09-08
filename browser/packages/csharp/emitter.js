import {ExpressionEmitter} from './emitter-expressions.js';
import {defaultValue} from './emitter-core.js';

export class Emitter extends ExpressionEmitter {
  block(n,s){const scope=this.scope(s);return `{\n${n.statements.map(x=>this.statement(x,scope)).join('\n')}\n}`;}
  statement(n,s){
    switch(n.kind){
      case'block':return this.block(n,s);
      case'empty':return ';';
      case'local':return 'let '+n.declarations.map(d=>{let t=d.type;if(t.name==='var')t={name:this.inferred(d.initial,s)};s.set(d.name,t);return `${d.name}=${d.initial?this.expr(d.initial,s):defaultValue(t)}`;}).join(',')+';';
      case'expression':return this.expr(n.value,s)+';';
      case'return':return `return${n.value?' '+this.expr(n.value,s):''};`;
      case'throw':return `throw ${n.value?this.expr(n.value,s):'$caught'};`;
      case'break':case'continue':return n.kind+';';
      case'if':return `if(${this.expr(n.condition,s)})${this.asBlock(n.then,s)}${n.otherwise?'else '+this.asBlock(n.otherwise,s):''}`;
      case'while':case'do':{const b=`{R.guard();${this.statement(n.body,this.scope(s))}}`;return n.kind==='while'?`while(${this.expr(n.condition,s)})${b}`:`do${b}while(${this.expr(n.condition,s)});`;}
      case'foreach':{const inner=this.scope(s);inner.set(n.name,n.type);return `for(const ${n.name} of ${this.expr(n.iterable,s)}){R.guard();${this.statement(n.body,inner)}}`;}
      case'for':{const inner=this.scope(s),init=n.init?this.statement(n.init,inner).replace(/;$/,''):'';return `for(${init};${n.condition?this.expr(n.condition,inner):'true'};${n.increments.map(x=>this.expr(x,inner)).join(',')}){R.guard();${this.statement(n.body,inner)}}`;}
      case'switch':return `switch(${this.expr(n.value,s)}){${n.sections.map(section=>section.labels.map(l=>l?'case '+this.expr(l,s)+':':'default:').join('')+section.statements.map(x=>this.statement(x,this.scope(s))).join('\n')).join('\n')}}`;
      case'try':{let code=`try${this.block(n.body,s)}`;if(n.catches.length){code+='catch($caught){';n.catches.forEach((c,i)=>{const inner=this.scope(s);inner.set(c.name,c.type||{name:'object'});inner.set('$caught',{name:'object'});code+=`${i?'else ':''}if(${c.type?'R.dotnet.is($caught,'+this.type(c.type)+')':'true'}){const ${c.name}=$caught;${this.block(c.body,inner)}}`;});code+='else {throw $caught;}}';}if(n.finalizer)code+='finally'+this.block(n.finalizer,s);return code;}
      default:this.report('JB2017',`No statement lowering for ${n.kind}`,n);return ';';
    }
  }
  asBlock(n,s){return n.kind==='block'?this.block(n,s):`{${this.statement(n,this.scope(s))}}`;}
  emitClass(c){
    this.current=c;const memberNames=new Set();let constructors=0;
    for(const m of c.members){if(m.kind==='constructor'){if(m.mods.includes('static'))this.report('JB2022','Static constructors require ordered type initialization',m);if(++constructors>1)this.report('JB2018','Constructor overloads need overload resolution',m);}else if(memberNames.has(m.name))this.report('JB2018',`Overloaded/duplicate member ${m.name} needs overload resolution`,m);else memberNames.add(m.name);}
    if(c.bases.length>1)this.report('JB2019','Multiple base/interface declarations require interface mapping',c);
    const base=c.bases[0]?this.type(c.bases[0]):'R.ObservableObject',body=[];
    for(const m of c.members){const stat=m.mods.includes('static')?'static ':'';const s=new Map();
      if(m.kind==='field'||m.kind==='event'){body.push(`${stat}${m.name}=${m.kind==='event'?'new R.dotnet.Event()':m.initial?this.expr(m.initial,s):defaultValue(m.type)};`);continue;}
      if(m.kind==='property'){
        if(m.auto){body.push(`${stat}__${m.name}=${m.initial?this.expr(m.initial,s):defaultValue(m.type)};`);if(m.get)body.push(`${stat}get ${m.name}(){return this.__${m.name};}`);if(m.set)body.push(`${stat}set ${m.name}(value){if(!Object.is(this.__${m.name},value)){this.__${m.name}=value;this.notify?.(${JSON.stringify(m.name)});}}`);}
        else{if(m.get&&m.get!==true)body.push(`${stat}get ${m.name}()${this.block(m.get,s)}`);if(m.set&&m.set!==true){s.set('value',m.type);body.push(`${stat}set ${m.name}(value)${this.block(m.set,s)}`);}if(m.get===true||m.set===true)this.report('JB2020','Mixed auto/manual property accessors are not implemented',m);}
        continue;
      }
      m.params.forEach(p=>s.set(p.name,p.type));
      const args=m.params.map(p=>p.name+(p.initial?'='+this.expr(p.initial,s):'')).join(',');
      if(m.kind==='constructor'){const content=this.block(m.body,s);body.push(`constructor(${args}){super(${m.baseArgs.map(x=>this.expr(x,s)).join(',')});${content.slice(1,-1)}}`);}
      else body.push(`${stat}${m.mods.includes('async')?'async ':''}${m.name}(${args}){R.guard();${this.block(m.body,s).slice(1,-1)}}`);
    }
    return `T[${JSON.stringify(c.fullName)}]=class ${c.name} extends ${base}{\nstatic __typeName=${JSON.stringify(c.fullName)};\n${body.join('\n')}\n};`;
  }
  emit(){
    const order=[],visiting=new Set(),done=new Set();
    const visit=c=>{if(done.has(c.fullName))return;if(visiting.has(c.fullName)){this.report('JB2021',`Inheritance cycle at ${c.fullName}`,c);return;}visiting.add(c.fullName);const base=c.bases[0]?.name;if(base){const match=this.classes.get(base)||this.classes.get(c.namespace+'.'+base)||[...this.classes.values()].find(x=>x.name===base);if(match)visit(match);}visiting.delete(c.fullName);done.add(c.fullName);order.push(c);};
    this.classes.forEach(visit);
    const code=['// Generated by Jailbreak. Runtime APIs are explicit extension points.','const T=R.types;',...Array.from(this.enums.values(),e=>`T[${JSON.stringify(e.fullName)}]=Object.freeze(${JSON.stringify(Object.fromEntries(e.values))});`),...order.map(c=>this.emitClass(c))].join('\n');
    return {ok:!this.diagnostics.length,code,diagnostics:this.diagnostics,classes:order.map(c=>({name:c.name,fullName:c.fullName,base:c.bases[0]?.name||null,methods:c.members.filter(m=>m.kind==='method').map(m=>m.name)}))};
  }
}

