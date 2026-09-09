import {parseXml} from '../compiler-core/xml.js';
import {lexCSharp} from '../csharp-compiler/lexer.js';
import {parseCSharp} from '../csharp-compiler/parser.js';
import {eventNames,controlDefinitions} from '../avalonia-runtime/schema.js';
import {sourcePath,sourceTransaction,snapshotFiles} from '../workspace/journal.js';
const AVALONIA='https://github.com/avaloniaui',XAML='http://schemas.microsoft.com/winfx/2006/xaml';
const layout=new Set('Name x:Name Margin Width Height MinWidth MinHeight MaxWidth MaxHeight HorizontalAlignment VerticalAlignment Grid.Row Grid.Column Grid.RowSpan Grid.ColumnSpan Canvas.Left Canvas.Top Canvas.Right Canvas.Bottom DockPanel.Dock'.split(' '));
const tag=n=>n.tag?.split(':').at(-1),escape=s=>s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
function xml(text,file){const p=parseXml(text,file);if(p.diagnostics.length)throw new Error('Refactoring requires valid XML: '+p.diagnostics[0].message);return p.root;}
function elements(root){const result=[];const visit=(node,parent=null)=>{if(node.kind!=='element')return;result.push({node,parent});for(const c of node.children)visit(c,node);};visit(root);return result;}
function identifier(value){if(!/^[A-Z][A-Za-z0-9_]*$/.test(value))throw new Error('Use a PascalCase component name containing letters, digits and underscores');return value;}
/** Extract self-contained literal XAML without changing external namescope/handler dependencies.
 * The candidate must additionally pass the normal project compiler before applying in Studio.
 */
export function extractComponent(input,file,offset,{name,namespace,path}={}){
  const files=snapshotFiles(input),text=files[file];if(typeof text!=='string'||!/\.a?xaml$/i.test(file))throw new Error('Select editable XAML to extract');
  identifier(name);const root=xml(text,file),all=elements(root),entry=all.find(e=>e.node.span.start===offset);
  if(!entry?.parent||!Object.hasOwn(controlDefinitions,tag(entry.node))||entry.node.tag.includes(':'))throw new Error('Select a built-in child visual, not the document root or a custom component');
  const owner=root.attributes['x:Class'];if(!owner)throw new Error('Component extraction requires an x:Class owner');
  namespace??=owner.includes('.')?owner.slice(0,owner.lastIndexOf('.')):'Components';
  if(!/^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*$/.test(namespace))throw new Error('Invalid C# namespace');
  const className=namespace+'.'+name,folder=file.includes('/')?file.slice(0,file.lastIndexOf('/')+1):'';
  path??=folder+'Components/'+name+'.axaml';sourcePath(path);if(!/\.axaml$/.test(path)||path===file)throw new Error('Use a new .axaml component path');
  const codePath=path+'.cs';if(Object.keys(files).some(p=>[path.toLowerCase(),codePath.toLowerCase()].includes(p.toLowerCase())))throw new Error('Component files already exist');
  const node=entry.node,sub=elements(node).map(e=>e.node),names=new Set(sub.map(n=>n.attributes.Name??n.attributes['x:Name']).filter(Boolean));
  const ns={};for(let e=entry;e;e=all.find(p=>p.node===e.parent))for(const [key,value]of Object.entries(e.node.attributes))if((key==='xmlns'||key.startsWith('xmlns:'))&&!Object.hasOwn(ns,key))ns[key]=value;
  if(ns.xmlns!==AVALONIA||ns['xmlns:x']!==XAML)throw new Error('Extraction requires the standard Avalonia and x namespaces');
  for(const [p,t]of Object.entries(files)){
    if(/\.cs$/i.test(p)){
      const parsed=parseCSharp(t,p);if(!parsed.ast||parsed.diagnostics.some(d=>d.severity==='error'))throw new Error('Resolve C# syntax before namescope-changing refactoring');
      if(parsed.ast.declarations.some(d=>d.fullName===className))throw new Error('Component type already exists');
      for(const token of lexCSharp(t,p).tokens)if((token.kind==='id'&&names.has(token.value))||(['string','interpolated'].includes(token.kind)&&[...names].some(n=>new RegExp('\\b'+n+'\\b').test(token.value))))throw new Error('Named control is referenced from C#; extraction would change ownership');
    }
    if(/\.a?xaml$/i.test(p))for(const e of elements(xml(t,p))){
      const n=e.node;
      if(['Style','ControlTheme','ControlTemplate','DataTemplate','TreeDataTemplate'].includes(tag(n))||tag(n).endsWith('.Styles'))throw new Error('Styled/template workspaces require dependency-aware component extraction');
      if(p===file&&n.span.start>=node.span.start&&n.span.end<=node.span.end)continue;
      for(const [key,value]of Object.entries(n.attributes))if(value.startsWith('{')&&[...names].some(n=>new RegExp('\\b'+n+'\\b').test(value)))throw new Error('External XAML namescope reference would be broken');
    }
  }
  for(const n of sub){
    if(n.tag.includes(':')||tag(n).includes('.')||!Object.hasOwn(controlDefinitions,tag(n)))throw new Error('Only self-contained built-in visual trees can be extracted');
    for(const [key,value]of Object.entries(n.attributes)){
      if(eventNames.includes(key)||eventNames.includes(key.split('.').at(-1)))throw new Error('Move event handlers explicitly before extracting this component');
      if(value.startsWith('{')&&!value.startsWith('{}')||key.startsWith('x:')&&!['x:Name'].includes(key)||['Classes','Theme','DataContext','Styles'].includes(key))throw new Error('Bindings, resources and ownership-sensitive metadata require explicit extraction');
    }
  }
  let prefix='component',i=1;while(Object.hasOwn(ns,'xmlns:'+prefix)&&ns['xmlns:'+prefix]!=='using:'+namespace)prefix='component'+i++;
  const moved=Object.entries(node.attributes).filter(([key])=>layout.has(key)),remove=moved.map(([key])=>node.attributeSpans[key]).sort((a,b)=>b.start-a.start);
  let fragment=text.slice(node.span.start,node.span.end);for(const span of remove){const a=span.start-node.span.start,b=span.end-node.span.start;fragment=fragment.slice(0,a)+fragment.slice(b);}
  const eol=text.includes('\r\n')?'\r\n':'\n',indent=/^\s*$/.test(text.slice(text.lastIndexOf('\n',offset)+1,offset))?text.slice(text.lastIndexOf('\n',offset)+1,offset):'';
  const wrapper='<'+prefix+':'+name+(moved.length?' '+moved.map(([k,v])=>`${k}="${escape(v)}"`).join(' '):'')+' />';
  let parent=text.slice(0,node.span.start)+wrapper+text.slice(node.span.end);
  if(ns['xmlns:'+prefix]!=='using:'+namespace){const at=root.span.start+1+root.tag.length;parent=parent.slice(0,at)+` xmlns:${prefix}="using:${namespace}"`+parent.slice(at);}
  const content=fragment.split(eol).map((line,j)=>'  '+(j&&line.startsWith(indent)?line.slice(indent.length):line)).join(eol);
  const component='<UserControl '+Object.entries(ns).map(([k,v])=>`${k}="${escape(v)}"`).join(' ')+` x:Class="${className}">`+eol+content+eol+'</UserControl>'+eol;
  const code=`using Avalonia.Controls;${eol}namespace ${namespace};${eol}public partial class ${name} : UserControl${eol}{${eol}    public ${name}() { InitializeComponent(); }${eol}}${eol}`;
  xml(parent,file);xml(component,path);
  return {...sourceTransaction([{path:file,before:text,after:parent},{path,before:null,after:component},{path:codePath,before:null,after:code}],'Extract '+className),focus:file,componentPath:path,className};
}
