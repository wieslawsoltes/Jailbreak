import {parseCSharp} from '../csharp-compiler/parser.js';
import {parseXml} from '../compiler-core/xml.js';
/** Bounded literal searches with original UTF-16 offsets, including non-ASCII case folding. */
export function findText(text,query,{caseSensitive=false,wholeWord=false,maxResults=10000}={}){
  if(typeof text!=='string'||typeof query!=='string')throw new TypeError('Search requires text');
  if(!query)return {matches:[],truncated:false};
  if(query.length>2000||!Number.isInteger(maxResults)||maxResults<1||maxResults>100000)throw new RangeError('Search budget exceeded');
  const pattern=query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const regex=new RegExp(pattern,caseSensitive?'gu':'giu'),matches=[];
  const word=c=>!!c&&/[\p{L}\p{N}_]/u.test(c);
  const before=i=>{if(!i)return '';const low=text.charCodeAt(i-1);return low>=0xdc00&&low<=0xdfff?text.slice(Math.max(0,i-2),i):text[i-1];};
  let m;
  while((m=regex.exec(text))){
    const end=m.index+m[0].length;
    if(wholeWord&&(word(before(m.index))||word(String.fromCodePoint(text.codePointAt(end)??32))))continue;
    if(matches.length===maxResults)return {matches,truncated:true};matches.push({start:m.index,end});
  }
  return {matches,truncated:false};
}
export function replaceText(text,query,replacement,options={}){
  const {matches,truncated}=findText(text,query,options);if(truncated)throw new RangeError('Too many replacements; refine the search');
  const parts=[];let offset=0;for(const m of matches){parts.push(text.slice(offset,m.start),String(replacement));offset=m.end;}parts.push(text.slice(offset));const after=parts.join('');
  return {before:text,after,count:matches.length};
}
export function lineOffset(text,line,column=1){
  if(!Number.isInteger(line)||line<1||!Number.isInteger(column)||column<1)throw new RangeError('Use a positive line and column');
  let at=0;for(let n=1;n<line;n++){const end=text.indexOf('\n',at);if(end<0)return text.length;at=end+1;}
  let end=text.indexOf('\n',at);if(end<0)end=text.length;if(text[end-1]==='\r')end--;return Math.min(end,at+column-1);
}
export function sourcePosition(text,start){
  const prefix=text.slice(0,start),line=prefix.split('\n').length,last=prefix.lastIndexOf('\n');return {line,column:start-last};
}
export function fuzzyScore(value,query){
  const hay=value.toLowerCase(),needle=query.trim().toLowerCase();if(!needle)return 0;
  let at=0,last=-2,score=0;
  for(const char of needle){const i=hay.indexOf(char,at);if(i<0)return -Infinity;score+=i===last+1?8:1;if(i===0||'/._ -'.includes(hay[i-1]))score+=12;score-=Math.min(6,i-at);last=i;at=i+1;}
  return score-0.01*value.length+(hay.endsWith(needle)?15:0);
}
export function rankItems(items,query,max=100){return items.map((item,i)=>({item,i,score:fuzzyScore(item.label+' '+(item.detail??''),query)})).filter(x=>Number.isFinite(x.score)).sort((a,b)=>b.score-a.score||a.i-b.i).slice(0,max).map(x=>x.item);}
export function documentSymbols(text,file){
  if(text.length>500000)return [];
  const result=[],add=(label,detail,start)=>result.push({label,detail,file,start,...sourcePosition(text,start)});
  if(/\.cs$/i.test(file)){
    const parsed=parseCSharp(text,file);if(!parsed.ast)return result;
    for(const type of parsed.ast.declarations){add(type.fullName,type.kind,type.start);for(const member of type.members??[])if(member.name)add(member.name,type.fullName+' · '+member.kind,member.start);}
  }else if(/\.a?xaml$/i.test(file)){
    const parsed=parseXml(text,file);if(!parsed.root)return result;
    function walk(n){if(n.kind!=='element')return;const name=n.attributes['x:Name']??n.attributes.Name;if(name||n===parsed.root)add(name??n.tag,n.tag,n.span.start);for(const c of n.children??[])walk(c);}walk(parsed.root);
  }
  return result;
}
export function searchWorkspace(files,query,options={}){
  const rows=[];let examined=0,truncated=false;const limit=options.maxResults??200;
  if(!query)return {rows,truncated};
  for(const [file,text]of Object.entries(files).sort(([a],[b])=>a.localeCompare(b))){
    if(/\.binary\.json$/i.test(file)||typeof text!=='string'||text.startsWith('data:'))continue;
    if((examined+=text.length)>16000000){truncated=true;break;}
    const found=findText(text,query,{...options,maxResults:limit});
    let scanned=0,line=1,lastNewline=-1;for(const m of found.matches){if(rows.length>=limit){truncated=true;break;}for(;scanned<m.start;scanned++)if(text[scanned]==='\n'){line++;lastNewline=scanned;}const position={line,column:m.start-lastNewline};let lineStart=text.lastIndexOf('\n',m.start-1)+1,lineEnd=text.indexOf('\n',m.end);if(lineEnd<0)lineEnd=text.length;rows.push({file,...m,...position,label:file+':'+position.line,detail:text.slice(lineStart,Math.min(lineEnd,lineStart+240))});}
    truncated ||= found.truncated;if(truncated)break;
  }
  return {rows,truncated};
}
export class DocumentPositions{
  constructor(limit=200){this.limit=limit;this.positions=new Map();}
  save(key,position){if(!key)return;this.positions.delete(key);this.positions.set(key,{...position});while(this.positions.size>this.limit)this.positions.delete(this.positions.keys().next().value);}
  get(key,length){const p=this.positions.get(key)??{start:0,end:0,top:0,left:0};return {...p,start:Math.max(0,Math.min(length,p.start)),end:Math.max(0,Math.min(length,p.end))};}
  clear(){this.positions.clear();}
}
