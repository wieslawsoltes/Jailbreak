import { DiagnosticBag, identifier, escapeJs } from '../compiler-core/index.js';
import { parseCSharp, parseExpression } from './parser.js';
import { controlDefinitions, commonProperties, eventNames } from '../avalonia-runtime/schema.js';
export { lexCSharp } from './lexer.js';
export { parseCSharp } from './parser.js';
const builtins = new Set(('Object ObservableObject AvaloniaObject AvaloniaProperty StyledProperty StyledElement Exception ArgumentException ArgumentNullException InvalidOperationException NotSupportedException DivideByZeroException List ObservableCollection Dictionary HashSet Queue Stack StringBuilder Event EventArgs TemplateAppliedEventArgs RoutedEventArgs PropertyChangedEventArgs PropertyChangedEventHandler EventHandler Action Func Task CancellationTokenSource RelayCommand DelegateCommand ReactiveCommand Math Console String Convert Enumerable Array DateTime TimeSpan Guid Debug Enum AvaloniaXamlLoader Brushes Colors Thickness CornerRadius Point Size Rect Vector Color SolidColorBrush Uri Binding ApplicationLifetime Dispatcher BindingMode').split(' ').concat(Object.keys(controlDefinitions)));
const interfaces = new Set('IDisposable INotifyPropertyChanged INotifyCollectionChanged ICommand IEnumerable ICollection IList IReadOnlyList IDictionary IEquatable IComparable IValueConverter'.split(' '));
const primitive = new Set('object string bool byte sbyte short ushort int uint float double char void var dynamic'.split(' '));
const linqMethods = new Set('Where Select SelectMany Any All Count First FirstOrDefault Last LastOrDefault Single SingleOrDefault Sum Average Min Max OrderBy OrderByDescending ThenBy ThenByDescending Take Skip Concat Distinct Reverse ToList ToArray Contains Aggregate'.split(' '));
const stringMethods = new Set('ToString Contains StartsWith EndsWith Substring ToUpper ToLower ToUpperInvariant ToLowerInvariant Trim TrimStart TrimEnd Replace Split IndexOf LastIndexOf PadLeft PadRight'.split(' '));
const inherited = new Set([...commonProperties,...eventNames,'InitializeComponent','ApplyTemplate','OnApplyTemplate','FindTemplateChild','FindControl','FindName','GetValue','SetValue','SetCurrentValue','ClearValue','PropertyChanged','RaisePropertyChanged','OnPropertyChanged','RaiseEvent','Focus','Children','Content','Items','Resources','Styles','DataContext','Show','Close','Hide','MainWindow','ApplicationLifetime','SetAndRaise','SetProperty','Dispose','GetType','ToString']);
const numeric=new Set(['byte','sbyte','short','ushort','int','uint','float','double']);
function flatName(e){if(e?.kind==='identifier')return e.name;if(e?.kind==='member'&&!e.optional){const left=flatName(e.object);if(left)return left+'.'+e.name;}return null;}
function defaultValue(t){if(!t||t.nullable||t.rank)return 'null';if(t.name==='bool')return 'false';if(numeric.has(t.name))return '0';if(t.name==='char')return '"\\0"';return 'null';}
/** Parse -> merge partial declarations -> resolve symbols -> emit JavaScript. */
export function compileCSharp(input, options={}) {
  const files=typeof input==='string'?[{path:options.path??'program.cs',text:input}]:input;
  const bag=new DiagnosticBag(),units=files.map(f=>parseCSharp(f.text,f.path));for(const u of units)bag.merge(u.diagnostics);
  const declarations=new Map(),allUsings=[];
  for(const unit of units){if(!unit.ast)continue;allUsings.push(...unit.ast.usings);for(const decl of unit.ast.declarations){decl.source=unit.source;for(const m of decl.members)m.source=unit.source;
    if(declarations.has(decl.fullName)){
      const old=declarations.get(decl.fullName);
      if(decl.kind!=='class'||!decl.mods.includes('partial')||!old.mods.includes('partial'))bag.add('JB2201',`Duplicate type ${decl.fullName}`,unit.source,decl.start);
      else {old.members.push(...decl.members);if(!old.bases.length)old.bases=decl.bases;}
    }else declarations.set(decl.fullName,decl);
  }}
  const externalTypes=new Set(options.externalTypes??[]);
  for(const name of externalTypes)if(declarations.has(name))bag.add('JB2250',`Source type conflicts with binary type ${name}`);
  const availableTypes=new Set([...declarations.keys(),...externalTypes]);
  const jsNames=new Map([...declarations].map(([name])=>[name,identifier(name)]));
  for(const name of externalTypes)if(!jsNames.has(name))jsNames.set(name,`(JB.types.get(${escapeJs(name)}))`);
  const warnings=new Set();let current=null,currentSource=null;
  const report=(code,message,node,severity='error')=>bag.add(code,message,currentSource??current?.source,node?.start??0,severity);
  function resolve(name,decl=current){
    if(availableTypes.has(name))return name;
    if(decl&&availableTypes.has(decl.namespace+'.'+name))return decl.namespace+'.'+name;
    for(const u of allUsings){if(u.alias===name){const aliased=resolve(u.name,null);if(aliased)return aliased;}if(availableTypes.has(u.name+'.'+name))return u.name+'.'+name;}
    const matches=[...availableTypes].filter(n=>n.split('.').at(-1)===name);
    return matches.length===1?matches[0]:null;
  }
  function typeRef(t,node=t){
    if(!t)return 'JB.Object';if(t.rank)return 'Array';let name=t.name.replace(/^global::/,'');
    const resolved=resolve(name);if(resolved)return jsNames.get(resolved);
    const short=name.split('.').at(-1);
    if(builtins.has(short))return 'JB.'+short;
    if(primitive.has(short))return {object:'JB.Object',string:'String',bool:'Boolean',void:'undefined'}[short]??'Number';
    if(interfaces.has(short))return 'JB.Object';
    if(current?.generics.includes(name))return 'JB.Object';
    report('JB2202',`Unresolved or unsupported type '${name}'`,node);return 'JB.Object';
  }
  function membersOf(decl,seen=new Set()){
    if(!decl||seen.has(decl.fullName))return [];seen.add(decl.fullName);
    const own=decl.members.filter(x=>x.name),base=resolve(decl.bases[0]?.name??'',decl);
    return [...own,...membersOf(declarations.get(base),seen)];
  }
  function context(extra={}){
    const members=new Map(membersOf(current).map(m=>[m.name,m]));
    for(const name of options.xamlNames?.[current.fullName]??[])members.set(name,{name,kind:'field',type:{name:'Control'},mods:[]});
    return {locals:new Map(),members,static:false,async:false,...extra};
  }
  function clone(ctx){return {...ctx,locals:new Map(ctx.locals)};}
  function infer(e,ctx){
    if(!e)return null;
    if(e.kind==='literal')return e.numericType??(typeof e.value==='string'?'string':typeof e.value==='boolean'?'bool':null);
    if(e.kind==='identifier')return ctx.locals.get(e.name)?.name??ctx.members.get(e.name)?.type?.name;
    if(e.kind==='new')return e.type?.name;
    if(e.kind==='cast')return e.type.name;
    if(e.kind==='group'||e.kind==='nullForgiving')return infer(e.expression,ctx);
    if(e.kind==='binary'){const a=infer(e.left,ctx),b=infer(e.right,ctx);if(e.op==='+'&&(a==='string'||b==='string'))return 'string';if(['+','-','*','/','%'].includes(e.op))return a==='int'&&b==='int'?'int':a??b;return 'bool';}
    if(e.kind==='member'&&['Length','Count','SelectedIndex'].includes(e.name))return 'int';
    return null;
  }
  function memberReference(name,ctx){const m=ctx.members.get(name);const owner=m?.mods?.includes('static')||m?.mods?.includes('const')?jsNames.get(current.fullName):'this';return m?.kind==='method'?`JB.method(${owner},${escapeJs(name)})`:`${owner}.${name}`;}
  function writeTarget(e,value,ctx){if(e.kind==='index')return `JB.setIndex(${expr(e.object,ctx)},${expr(e.index,ctx)},${value})`;return `(${expr(e,ctx)} = ${value})`;}
  function expr(e,ctx,expected=null){
    if(!e)return '';
    switch(e.kind){
      case 'literal':return escapeJs(e.value);
      case 'identifier':{
        if(e.name==='this')return 'this';if(e.name==='base')return 'super';if(e.name==='value'&&ctx.locals.has('value'))return 'value';
        if(ctx.locals.has(e.name))return e.name;
        if(ctx.members.has(e.name))return memberReference(e.name,ctx);
        if(inherited.has(e.name))return 'this.'+e.name;
        const resolved=resolve(e.name);if(resolved)return jsNames.get(resolved);
        if(builtins.has(e.name))return 'JB.'+e.name;
        if(e.name==='string')return 'JB.String';if(e.name==='int'||e.name==='double'||e.name==='float')return 'JB.Convert';
        if(e.name==='nameof')return 'undefined';
        report('JB2203',`Unresolved identifier '${e.name}'`,e);return 'undefined';
      }
      case 'member':{
        const flat=flatName(e),resolved=flat?resolve(flat):null;if(resolved)return jsNames.get(resolved);
        if(flat?.startsWith('System.')&&builtins.has(flat.split('.').at(-1)))return 'JB.'+flat.split('.').at(-1);
        if(flat?.startsWith('Avalonia.')&&builtins.has(flat.split('.').at(-1)))return 'JB.'+flat.split('.').at(-1);
        const object=expr(e.object,ctx);
        if(e.name==='Length'||e.name==='Count')return `JB.length(${object})`;
        return `${object}${e.optional?'?.':'.'}${e.name}`;
      }
      case 'call':{
        const args=e.args.map(a=>expr(a,ctx));
        if(e.callee.kind==='member'){
          const m=e.callee,name=m.name,obj=expr(m.object,ctx);
          if(name==='Load'&&flatName(m.object)?.endsWith('AvaloniaXamlLoader'))return `JB.loadXaml(${args[0]??'this'})`;
          if(name==='FindControl'||name==='FindName')return `${obj}.${name}(${args.join(',')})`;
          if(name==='GetType')return `JB.getType(${obj})`;
          if(stringMethods.has(name))return `JB.invoke(${obj},${escapeJs(name)},[${args.join(',')}],${!!m.optional})`;
          if(linqMethods.has(name)&&flatName(m.object)!=='Enumerable')return `JB.Enumerable.${name}(${obj}${args.length?','+args.join(','):''})`;
        }
        return `${expr(e.callee,ctx)}(${args.join(',')})`;
      }
      case 'index':return `JB.getIndex(${expr(e.object,ctx)},${expr(e.index,ctx)},${!!e.optional})`;
      case 'group':return `(${expr(e.expression,ctx)})`;
      case 'nullForgiving':return expr(e.expression,ctx);
      case 'binary':{
        const a=expr(e.left,ctx),b=expr(e.right,ctx),type=infer(e,ctx);
        if(type==='int'&&['+','-','*','/','%'].includes(e.op))return `JB.${{'+':'iadd','-':'isub','*':'imul','/':'idiv','%':'irem'}[e.op]}(${a},${b})`;
        return `(${a} ${{'==':'===','!=':'!=='}[e.op]??e.op} ${b})`;
      }
      case 'assignment':{
        const member=e.left.kind==='identifier'?ctx.members.get(e.left.name):null,name=e.left.name;
        const owner=e.left.kind==='member'?expr(e.left.object,ctx):'this';
        if(['+=','-='].includes(e.op)&&(member?.kind==='event'||eventNames.includes(name)||name==='PropertyChanged'||name==='CollectionChanged'))return `JB.${e.op==='+='?'eventAdd':'eventRemove'}(${owner},${escapeJs(name)},${expr(e.right,ctx)})`;
        if(e.op==='=')return writeTarget(e.left,expr(e.right,ctx,member?.type),ctx);
        if(e.left.kind==='index')return `JB.updateIndex(${expr(e.left.object,ctx)},${expr(e.left.index,ctx)},${escapeJs(e.op)},${expr(e.right,ctx)})`;
        if(infer(e.left,ctx)==='int'&&['+=','-=','*=','/=','%='].includes(e.op))return writeTarget(e.left,`JB.${{'+=':'iadd','-=':'isub','*=':'imul','/=':'idiv','%=':'irem'}[e.op]}(${expr(e.left,ctx)},${expr(e.right,ctx)})`,ctx);
        return `(${expr(e.left,ctx)} ${e.op} ${expr(e.right,ctx)})`;
      }
      case 'postfix':return e.argument.kind==='index'?`JB.incrementIndex(${expr(e.argument.object,ctx)},${expr(e.argument.index,ctx)},${e.op==='++'?1:-1},true)`:`(${expr(e.argument,ctx)}${e.op})`;
      case 'unary':if(e.op==='await'&&!ctx.async)report('JB2204','await requires an async method/lambda',e);return `(${e.op}${e.op==='await'?' ':''}${expr(e.argument,ctx)})`;
      case 'conditional':return `(${expr(e.test,ctx)} ? ${expr(e.consequent,ctx)} : ${expr(e.alternate,ctx)})`;
      case 'lambda':{const inner=clone(ctx);for(const p of e.parameters)inner.locals.set(p.name,p.type??{name:'object'});return `(${e.parameters.map(p=>p.name).join(',')}) => ${e.body.kind==='block'?stmt(e.body,inner):expr(e.body,inner)}`;}
      case 'new':{
        const t=e.type??expected;
        if(!t&&!e.members?.length){report('JB2206','Target-typed new requires a declared target type',e);return 'null';}
        if(!t&&e.members?.length)return `({${e.members.map(m=>`${escapeJs(m.name)}:${expr(m.value,ctx)}`).join(',')}})`;
        if(t.rank){if(e.length)return `JB.newArray(${expr(e.length,ctx)},${defaultValue({...t,rank:0})})`;return `[${(e.items??[]).map(a=>expr(a,ctx)).join(',')}]`;}
        let code=`new ${typeRef(t,e)}(${e.args.map(a=>expr(a,ctx)).join(',')})`;
        if(e.members?.length)code=`Object.assign(${code},{${e.members.map(m=>`${escapeJs(m.name)}:${expr(m.value,ctx)}`).join(',')}})`;
        if(e.items?.length)code=`JB.initializeCollection(${code},[${e.items.map(a=>a.kind==='initializerPair'?`[${a.items.map(x=>expr(x,ctx)).join(',')}]`:expr(a,ctx)).join(',')}])`;
        return code;
      }
      case 'cast':{
        if(['int','short','byte','uint'].includes(e.type.name))return `JB.toInt(${expr(e.expression,ctx)})`;
        if(['double','float'].includes(e.type.name))return `Number(${expr(e.expression,ctx)})`;
        return `JB.cast(${expr(e.expression,ctx)},${typeRef(e.type)})`;
      }
      case 'typeTest':return e.type.kind==='literal'?`(${expr(e.left,ctx)} === null)`:`JB.${e.op==='as'?'as':'is'}(${expr(e.left,ctx)},${typeRef(e.type)})`;
      case 'typeof':return `JB.typeInfo(${typeRef(e.type)})`;
      case 'default':return defaultValue(e.type??expected);
      case 'nameof':return escapeJs(e.expression.name??flatName(e.expression)?.split('.').at(-1)??'');
      case 'interpolated':{
        const parts=[];let text='',i=0;
        while(i<e.value.length){const c=e.value[i++];if(c==='{'&&e.value[i]==='{'){text+='{';i++;continue;}if(c==='}'&&e.value[i]==='}'){text+='}';i++;continue;}
          if(c!=='{'){text+=c;continue;}if(text){parts.push(escapeJs(text));text='';}
          let depth=1,s='',quote=null;
          while(i<e.value.length&&depth){const x=e.value[i++];if(quote){s+=x;if(x==='\\')s+=e.value[i++]??'';else if(x===quote)quote=null;continue;}if(x==='"'||x==="'"){quote=x;s+=x;continue;}if(x==='{')depth++;if(x==='}')depth--;if(depth)s+=x;}
          const fmt=/^([\s\S]*?)(?::([A-Za-z]\d*))$/.exec(s);try{parts.push(`JB.formatValue(${expr(parseExpression(fmt?fmt[1]:s),ctx)},${escapeJs(fmt?.[2]??null)})`);}catch(error){report('JB2207',`Invalid interpolation: ${error.message}`,e);}
        }
        if(text)parts.push(escapeJs(text));return '('+(parts.length?parts.join(' + '):'""')+')';
      }
      default:report('JB2299',`Emitter missing expression '${e.kind}'`,e);return 'undefined';
    }
  }
  function stmt(s,ctx){
    if(!s)return '{}';
    switch(s.kind){
      case 'block':{const inner=clone(ctx);return '{\n'+s.statements.map(x=>stmt(x,inner)).join('\n')+'\n}';}
      case 'empty':return ';';
      case 'expressionStatement':return expr(s.expression,ctx)+';';
      case 'expressionBody':return '{ return '+expr(s.expression,ctx)+'; }';
      case 'local':{
        const parts=[];for(const v of s.variables){const type=s.type.name==='var'?{name:infer(v.init,ctx)??'object'}:s.type;const value=v.init?expr(v.init,ctx,type):defaultValue(type);ctx.locals.set(v.name,type);parts.push(`${v.name} = ${value}`);}return 'let '+parts.join(', ')+';';
      }
      case 'if':return `if (${expr(s.test,ctx)}) ${stmt(s.consequent,clone(ctx))}${s.alternate?' else '+stmt(s.alternate,clone(ctx)):''}`;
      case 'return':return 'return'+(s.expression?' '+expr(s.expression,ctx):'')+';';
      case 'throw':return 'throw '+(s.expression?expr(s.expression,ctx):ctx.catchName??'__error')+';';
      case 'break':case 'continue':return s.kind+';';
      case 'while':return `while (${expr(s.test,ctx)}) ${stmt(s.body,clone(ctx))}`;
      case 'do':return `do ${stmt(s.body,clone(ctx))} while (${expr(s.test,ctx)});`;
      case 'for':{const inner=clone(ctx),init=s.init?(s.init.kind==='local'?stmt(s.init,inner).replace(/;$/,''):expr(s.init,inner)):'';return `for (${init}; ${s.test?expr(s.test,inner):''}; ${s.update?expr(s.update,inner):''}) ${stmt(s.body,inner)}`;}
      case 'foreach':{const inner=clone(ctx);inner.locals.set(s.name,s.type);return `for (const ${s.name} of JB.iterate(${expr(s.iterable,ctx)})) ${stmt(s.body,inner)}`;}
      case 'switch':return `switch (${expr(s.expression,ctx)}) {\n${s.cases.map(c=>(c.value?'case '+expr(c.value,ctx):'default')+':\n'+c.statements.map(x=>stmt(x,ctx)).join('\n')).join('\n')}\n}`;
      case 'try':{
        let code='try '+stmt(s.body,clone(ctx));if(s.catches.length){code+=' catch (__caught) {\n';for(let i=0;i<s.catches.length;i++){const c=s.catches[i],inner=clone(ctx);inner.locals.set(c.name,{name:c.type?.name??'Exception'});inner.catchName=c.name;code+=(i?'else ':'')+'if ('+(c.type?`JB.is(__caught,${typeRef(c.type)})`:'true')+') { const '+c.name+' = __caught; '+stmt(c.body,inner)+' }\n';}code+='else { throw __caught; }\n}';}if(s.finalizer)code+=' finally '+stmt(s.finalizer,clone(ctx));return code;
      }
      default:report('JB2298',`Emitter missing statement '${s.kind}'`,s);return ';';
    }
  }
  const chunks=[],ordered=[],visiting=new Set(),visited=new Set();
  function visit(decl){if(visited.has(decl.fullName))return;if(visiting.has(decl.fullName)){bag.add('JB2208','Inheritance cycle: '+decl.fullName,decl.source,decl.start);return;}visiting.add(decl.fullName);for(const b of decl.bases){const full=resolve(b.name,decl);if(full&&declarations.get(full).kind==='class')visit(declarations.get(full));}visiting.delete(decl.fullName);visited.add(decl.fullName);ordered.push(decl);}
  for(const d of declarations.values())visit(d);
  for(const decl of ordered){
    current=decl;currentSource=decl.source;
    for(const attr of [...decl.attributes,...decl.members.flatMap(m=>m.attributes??[])]){
      if(/ObservableProperty|RelayCommand|GeneratedRegex|LibraryImport/.test(attr))report('JB2210',`Source-generator attribute '${attr}' requires a generator adapter`,decl);
      else if(!warnings.has(attr)){warnings.add(attr);report('JB2211',`Attribute '${attr}' is retained only as metadata`,decl,'warning');}
    }
    if(decl.kind==='interface')continue;
    const js=jsNames.get(decl.fullName);
    if(decl.kind==='enum'){let next=0;const ctx=context();const fields=decl.members.map(m=>{const value=m.value?expr(m.value,ctx):String(next);next=m.value?.kind==='literal'?Number(m.value.value)+1:next+1;return `${escapeJs(m.name)}:${value}`;});chunks.push(`const ${js}=Object.freeze({${fields.join(',')}}); JB.defineType(${escapeJs(decl.fullName)},${js});`);continue;}
    for(const m of decl.members)if(m.type&&['long','ulong','decimal','dynamic'].includes(m.type.name))report('JB2212',`Type '${m.type.name}' requires an extended numeric/dynamic backend`,m);
    const classBases=decl.bases.filter(b=>!interfaces.has(b.name.split('.').at(-1))&&declarations.get(resolve(b.name))?.kind!=='interface');
    const base=classBases.length?typeRef(classBases[0]):'JB.Object';const body=[];
    for(const m of decl.members){currentSource=m.source??decl.source;const stat=m.mods.includes('static')||m.mods.includes('const'),ctx=context({static:stat});
      if(m.kind==='field')body.push(`${stat?'static ':''}${m.name} = ${m.init?expr(m.init,ctx,m.type):defaultValue(m.type)};`);
      if(m.kind==='event')body.push(`${stat?'static ':''}${m.name} = new JB.Event();`);
      if(m.kind==='property'){
        const auto=m.get?.kind==='auto'||m.set?.kind==='auto';if(auto)body.push(`${stat?'static ':''}__${m.name} = ${m.init?expr(m.init,ctx,m.type):defaultValue(m.type)};`);
        if(m.get)body.push(`${stat?'static ':''}get ${m.name}() ${m.get.kind==='auto'?`{ return this.__${m.name}; }`:stmt(m.get,ctx)}`);
        if(m.set){ctx.locals.set('value',m.type);body.push(`${stat?'static ':''}set ${m.name}(value) ${m.set.kind==='auto'?`{ const old = this.__${m.name}; this.__${m.name}=value; JB.notify(this,${escapeJs(m.name)},value,old); }`:stmt(m.set,ctx)}`);}
      }
    }
    const constructors=decl.members.filter(m=>m.kind==='constructor');
    const ctorBody=[];for(const m of constructors){currentSource=m.source??decl.source;const ctx=context();for(const p of m.parameters)ctx.locals.set(p.name,p.type);const min=m.parameters.filter(p=>!p.value&&!p.rest).length,max=m.parameters.some(p=>p.rest)?Infinity:m.parameters.length;
      if(m.initializer&&constructors.length>1)report('JB2213','Multiple constructors with explicit base initializers are not implemented',m);
      ctorBody.push({m,ctx,min,max});}
    if(constructors.length<=1){const c=ctorBody[0],params=c?c.m.parameters.map(p=>(p.rest?'...':'')+p.name+(p.value?' = '+expr(p.value,c.ctx):'')).join(','):'';
      const superArgs=c?.m.initializer?.args.map(a=>expr(a,c.ctx)).join(',')??'';
      body.push(`constructor(${params}) { super(${superArgs}); ${c?stmt(c.m.body,c.ctx):(options.xamlNames?.[decl.fullName]?'this.InitializeComponent();':'')} }`);
    } else {body.push(`constructor(...__args) { super();\n${ctorBody.map((c,i)=>(i?'else ':'')+`if (__args.length >= ${c.min} && __args.length <= ${c.max===Infinity?'Infinity':c.max}) { const [${c.m.parameters.map(p=>(p.rest?'...':'')+p.name+(p.value?' = '+expr(p.value,c.ctx):'')).join(',')}] = __args; ${stmt(c.m.body,c.ctx)} }`).join('\n')} else { throw new JB.ArgumentException('No constructor matches argument count'); } }`);}
    const groups=new Map();for(const m of decl.members.filter(m=>m.kind==='method')){const key=(m.mods.includes('static')?'static:':'')+m.name;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(m);}
    for(const group of groups.values()){
      const arities=new Set();for(const m of group){currentSource=m.source??decl.source;const ctx=context({static:m.mods.includes('static'),async:m.mods.includes('async')});for(const p of m.parameters)ctx.locals.set(p.name,p.type);
        if(arities.has(m.parameters.length))report('JB2214',`Overloads of '${m.name}' with the same arity need type-based overload resolution`,m);arities.add(m.parameters.length);
        const name=m.name+(group.length>1?'$'+m.parameters.length:'');const params=m.parameters.map(p=>(p.rest?'...':'')+p.name+(p.value?' = '+expr(p.value,ctx):'')).join(',');
        body.push(`// ${currentSource.path}:${currentSource.location(m.start).line}\n${ctx.static?'static ':''}${ctx.async?'async ':''}${name}(${params}) ${m.body?stmt(m.body,ctx):`{ throw new JB.NotSupportedException('Abstract method ${m.name}'); }`}`);
      }
      if(group.length>1){const m=group[0],stat=m.mods.includes('static');body.push(`${stat?'static ':''}${m.name}(...args) { switch(args.length) { ${group.map(x=>`case ${x.parameters.length}: return this.${x.name}$${x.parameters.length}(...args);`).join(' ')} default: throw new JB.ArgumentException('No overload matches argument count'); } }`);}
    }
    chunks.push(`class ${js} extends ${base} {\n${body.join('\n')}\n}\nJB.defineType(${escapeJs(decl.fullName)}, ${js});`);
  }
  const code=bag.hasErrors?'':chunks.join('\n\n');
  return {success:!bag.hasErrors,code,diagnostics:bag.items,types:[...declarations.values()].map(d=>({name:d.fullName,kind:d.kind,members:d.members.map(m=>({name:m.name,kind:m.kind}))})),ast:options.includeAst?units.map(u=>u.ast):undefined};
}
