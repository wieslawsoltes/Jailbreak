/** Source Map v3 generation for compiler sequence points (UTF-16 columns). */
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function vlq(value){
  if(!Number.isSafeInteger(value)||Math.abs(value)>0x3fffffff)throw new RangeError('Source-map delta out of range');
  let n=value<0?-value*2+1:value*2,result='';
  do{let digit=n%32;n=Math.floor(n/32);if(n)digit+=32;result+=alphabet[digit];}while(n);
  return result;
}
export function createSourceMap(code,sites,files,{file='jailbreak-app.js'}={}){
  const sources=[...new Set(sites.map(p=>p.file))],byId=new Map(sites.map(p=>[String(p.id),p])),points=[];
  let offset=0,line=0,column=0;
  const advance=end=>{for(;offset<end;offset++){if(code[offset]==='\n'){line++;column=0;}else column++;}};
  for(const match of code.matchAll(/^\/\*@jb:([\w]+)\*\//gm)){
    advance(match.index+match[0].length);const point=byId.get(match[1]);
    if(point){
      const mapping={generatedLine:line,generatedColumn:column,source:sources.indexOf(point.file),line:point.line-1,column:point.column-1,id:point.id};points.push(mapping);
      const tail=code.indexOf('\n',offset);
      if((code.slice(offset).startsWith('if(C.debugHit(')||code.slice(offset).startsWith('if(JB.dev?.hit(')||code.slice(offset).startsWith('yield $co.checkpoint('))&&tail>=0)points.push({...mapping,generatedLine:line+1,generatedColumn:0});
    }
  }
  let source=0,originalLine=0,originalColumn=0,lastLine=0,lastColumn=0,mappings='',first=true;
  points.sort((a,b)=>a.generatedLine-b.generatedLine||a.generatedColumn-b.generatedColumn);
  for(const p of points){while(lastLine<p.generatedLine){mappings+=';';lastLine++;lastColumn=0;first=true;}
    if(!first)mappings+=',';first=false;
    mappings+=vlq(p.generatedColumn-lastColumn)+vlq(p.source-source)+vlq(p.line-originalLine)+vlq(p.column-originalColumn);
    lastColumn=p.generatedColumn;source=p.source;originalLine=p.line;originalColumn=p.column;
  }
  return {version:3,file,sources:sources.map(p=>'jailbreak://workspace/'+p.split('/').map(encodeURIComponent).join('/')),sourcesContent:sources.map(p=>files instanceof Map?files.get(p)??null:files[p]??null),names:[],mappings};
}
export function inlineSourceMap(map){
  const bytes=new TextEncoder().encode(JSON.stringify(map));let binary='';
  for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return '//# sourceMappingURL=data:application/json;charset=utf-8;base64,'+btoa(binary);
}
/** Resolve emitted sequence points after prefixes/wrappers have been composed. */
export function mappedScript(code,debug,files){files={...Object.fromEntries(files instanceof Map?files:Object.entries(files??{})),...debug?.sources};return code+'\n//# sourceURL=jailbreak-app.js\n'+inlineSourceMap(createSourceMap(code,debug?.sites??[],files));}

export function updateGeneratedLocations(code, debug){
  const sites=new Map((debug?.sites??[]).map(p=>[String(p.id),p]));let line=1,last=0;
  for(const match of code.matchAll(/^\/\*@jb:([\w]+)\*\//gm)){for(;last<match.index;last++)if(code[last]==='\n')line++;const point=sites.get(match[1]);if(point)point.generatedLine=line;}
  return debug;
}
