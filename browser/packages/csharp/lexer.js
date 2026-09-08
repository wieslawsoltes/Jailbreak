import {CompileError, location} from '../core/index.js';

export const modifiers = new Set('public private protected internal static partial sealed abstract virtual override readonly const async new extern volatile'.split(' '));
export const primitive = new Set('void bool byte sbyte short ushort int uint long ulong float double decimal char string object var dynamic'.split(' '));
export const unsupported = new Set('unsafe fixed stackalloc lock yield goto checked unchecked record struct delegate operator implicit explicit'.split(' '));
const escapeMap = {'0':'\0',a:'\x07',b:'\b',f:'\f',n:'\n',r:'\r',t:'\t',v:'\x0b',"'":"'",'"':'"','\\':'\\'};

export function tokenize(source, file = '') {
  const out=[];let i=0;
  const error=(message,start=i)=>{throw new CompileError('JB2001',message,source,start,file);};
  const add=(kind,value,start,extra={})=>out.push({kind,value,...location(source,start),...extra});
  while(i<source.length){
    let c=source[i],start=i;
    if(/\s/.test(c)){i++;continue;}
    if(source.startsWith('//',i)){while(i<source.length&&source[i]!=='\n')i++;continue;}
    if(source.startsWith('/*',i)){const end=source.indexOf('*/',i+2);if(end<0)error('Unterminated comment');i=end+2;continue;}
    if(c==='#'){
      const end=source.indexOf('\n',i),line=source.slice(i,end<0?undefined:end);
      if(!/^#\s*(nullable\s+(enable|disable|restore)|region\b.*|endregion\b.*)$/.test(line))error(`Unsupported preprocessor directive ${line}`);
      i=end<0?source.length:end;continue;
    }
    let verbatim=false,interpolated=false;
    if(c==='$'&&(source[i+1]==='"'||source.startsWith('$@"',i))){interpolated=true;i++;c=source[i];}
    if(c==='@'&&source[i+1]==='$'&&source[i+2]==='"'){interpolated=true;verbatim=true;i+=2;c=source[i];}
    if(c==='@'&&source[i+1]==='"'){verbatim=true;i++;c='"';}
    if(c==='"'||c==="'"){
      const quote=c;i++;let value='',closed=false,braceDepth=0;
      while(i<source.length){
        let ch=source[i++];
        if(ch===quote){if(verbatim&&source[i]===quote){value+=quote;i++;continue;}if(interpolated&&braceDepth>0){value+=ch;continue;}closed=true;break;}
        if(interpolated&&ch==='{'){if(source[i]==='{'){value+='{{';i++;continue;}braceDepth++;}
        if(interpolated&&ch==='}'){if(braceDepth===0&&source[i]==='}'){value+='}}';i++;continue;}braceDepth--;}
        if(ch==='\\'&&!verbatim){const e=source[i++];if(Object.hasOwn(escapeMap,e))ch=escapeMap[e];else if(e==='u'||e==='U'){const size=e==='u'?4:8,hex=source.slice(i,i+size);if(!new RegExp(`^[0-9a-fA-F]{${size}}$`).test(hex))error('Invalid Unicode escape',i);const cp=parseInt(hex,16);if(cp>0x10ffff)error('Unicode escape out of range',i);ch=String.fromCodePoint(cp);i+=size;}else error(`Unsupported escape \\${e}`,i-2);}
        if(!verbatim&&(ch==='\n'||ch==='\r')&&source[i-1]!=='n'&&source[i-1]!=='r')error('Newline in regular string',start);
        value+=ch;
      }
      if(!closed)error('Unterminated string literal',start);
      if(quote==="'"&&value.length!==1)error('A char literal must contain one UTF-16 code unit',start);
      add(interpolated?'interpolated':'string',value,start,{char:quote==="'"});continue;
    }
    if(/[0-9]/.test(c)){
      const m=/^(?:0[xX][\da-fA-F_]+|0[bB][01_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d[\d_]*)?)(?:[fFdDmMuUlL]*)/.exec(source.slice(i));
      i+=m[0].length;let raw=m[0].replace(/_/g,''),suffix=(raw.match(/[fFdDmMuUlL]+$/)||[''])[0];
      if(/^0[xX]/.test(raw))suffix='';
      if(/[mMuUlL]/.test(suffix))error('decimal, unsigned and 64-bit numeric literals need a numeric lowering extension',start);
      const number=Number(suffix?raw.slice(0,-suffix.length):raw);if(!Number.isFinite(number))error('Invalid numeric literal',start);
      add('number',number,start,{numericType: /[.eEfFdD]/.test(suffix?raw:raw.replace(/^0[xX][\da-fA-F]+$/,'0'))?'double':'int'});continue;
    }
    if(/[A-Za-z_@]/.test(c)){
      const m=/^@?[A-Za-z_]\w*/.exec(source.slice(i));if(!m)error('Invalid identifier');i+=m[0].length;add('id',m[0].replace(/^@/,''),start);continue;
    }
    const op=['??=','=>','?.','??','++','--','+=','-=','*=','/=','%=','==','!=','<=','>=','&&','||','&=','|=','^=','::'].find(x=>source.startsWith(x,i));
    if(op){i+=op.length;add('punct',op,start);continue;}
    if('{}()[];:,.?+-*/%<>=!~&|^'.includes(c)){i++;add('punct',c,start);continue;}
    error(`Unexpected character ${JSON.stringify(c)}`);
  }
  add('eof','<eof>',i);return out;
}
