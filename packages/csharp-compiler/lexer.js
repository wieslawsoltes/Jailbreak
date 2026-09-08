import { SourceFile, DiagnosticBag, CompileError } from '../compiler-core/index.js';
const operators = ['??=','=>','?.','?[','++','--','+=','-=','*=','/=','%=','==','!=','<=','>=','&&','||','??','<<','>>','&=','|=','^=','::','..'];
/** C# tokenization is separate from parsing; no regex-based source transpilation. */
export function lexCSharp(text, path = 'program.cs') {
  const source = new SourceFile(path,text), bag = new DiagnosticBag(), tokens = []; let i=0;
  const token=(kind,value,start,extra={})=>tokens.push({kind,value,start,end:i,...extra});
  function stringToken(start,interpolated,verbatim,char=false) {
    const quote=char?"'":'"';let content='',depth=0,innerQuote=null;
    while(i<text.length) {
      const c=text[i++];
      if(interpolated && depth>0) {
        content+=c;
        if(innerQuote){if(c==='\\'){content+=text[i++]??'';}else if(c===innerQuote)innerQuote=null;}
        else if(c==='"'||c==="'")innerQuote=c;
        else if(c==='{')depth++;
        else if(c==='}')depth--;
        continue;
      }
      if(c===quote) {
        if(verbatim&&text[i]===quote){content+=quote;i++;continue;}
        if(char&&content.length!==1)throw new CompileError('JB2002','A character literal must contain one UTF-16 code unit',start);
        token(interpolated?'interpolated':char?'char':'string',content,start,{verbatim});return;
      }
      if(interpolated&&c==='{'&&text[i]!=='{'){depth++;content+=c;continue;}
      if(interpolated&&c==='{'&&text[i]==='{'){content+='{{';i++;continue;}
      if(!verbatim&&(c==='\n'||c==='\r'))throw new CompileError('JB2002','A regular string literal cannot span lines',start);
      if(c==='\\'&&!verbatim) {const n=text[i++];const esc={n:'\n',r:'\r',t:'\t','0':'\0',a:'\x07',b:'\b',f:'\f',v:'\v','\\':'\\','"':'"',"'":"'"};
        if(n==='u'||n==='U'){const len=n==='u'?4:8,hex=text.slice(i,i+len);if(!new RegExp(`^[a-fA-F0-9]{${len}}$`).test(hex))throw new CompileError('JB2002','Invalid Unicode escape',i);content+=String.fromCodePoint(parseInt(hex,16));i+=len;}
        else if(Object.hasOwn(esc,n))content+=esc[n];else throw new CompileError('JB2002',`Unsupported escape \\${n}`,i-2);
      } else content+=c;
    }
    throw new CompileError('JB2002','Unterminated string literal',start);
  }
  try {
    while(i<text.length) {
      const c=text[i],start=i;
      if(/\s/.test(c)){i++;continue;}
      if(text.startsWith('//',i)){while(i<text.length&&text[i]!=='\n')i++;continue;}
      if(text.startsWith('/*',i)){const end=text.indexOf('*/',i+2);if(end<0)throw new CompileError('JB2001','Unterminated comment',i);i=end+2;continue;}
      if(c==='#'){while(i<text.length&&text[i]!=='\n')i++;const directive=text.slice(start,i);if(!/^#(nullable|region|endregion|pragma\s+warning)\b/.test(directive))bag.add('JB2010',`Unsupported preprocessor directive: ${directive}`,source,start);continue;}
      if(text.startsWith('"""',i)||text.startsWith('$"""',i))throw new CompileError('JB2011','Raw string literals are not implemented',i);
      if(text.startsWith('$@"',i)||text.startsWith('@$"',i)){i+=3;stringToken(start,true,true);continue;}
      if(text.startsWith('$"',i)){i+=2;stringToken(start,true,false);continue;}
      if(text.startsWith('@"',i)){i+=2;stringToken(start,false,true);continue;}
      if(c==='"'||c==="'"){i++;stringToken(start,false,false,c==="'");continue;}
      if(/[A-Za-z_@]/.test(c)){i++;while(i<text.length&&/[A-Za-z0-9_]/.test(text[i]))i++;token('id',text.slice(start,i).replace(/^@/,''),start);continue;}
      if(/[0-9]/.test(c)){
        const match=/^(?:0[xX][\da-fA-F_]+|0[bB][01_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?)[uUlLfFdDmM]*/.exec(text.slice(i));
        i+=match[0].length;const raw=match[0].replaceAll('_',''),radix=/^0[xXbB]/.test(raw),suffixPattern=radix?/[uUlL]+$/:/[uUlLfFdDmM]+$/;const suffix=raw.match(suffixPattern)?.[0]??'';
        if(/[mMlL]/.test(suffix))bag.add('JB2012','decimal and 64-bit integer literals are outside the numeric profile',source,start);
        token('number',raw.replace(suffixPattern,''),start,{numericType:!radix&&/[.eEfFdD]/.test(raw)?'double':'int'});continue;
      }
      const op=operators.find(o=>text.startsWith(o,i));if(op){i+=op.length;token('symbol',op,start);continue;}
      if('{}()[];:,.?+-*/%<>=!~&|^'.includes(c)){i++;token('symbol',c,start);continue;}
      throw new CompileError('JB2001',`Unexpected character '${c}'`,i);
    }
  }catch(e){if(!(e instanceof CompileError))throw e;bag.add(e.code,e.message,source,e.offset);}
  tokens.push({kind:'eof',value:'<eof>',start:i,end:i});return {tokens,source,diagnostics:bag.items};
}
