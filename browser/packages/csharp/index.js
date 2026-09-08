import {failure} from '../core/index.js';
import {tokenize} from './lexer.js';
import {Parser} from './parser.js';
import {Emitter} from './emitter.js';
export {tokenize,Parser,Emitter};

export function compileCSharp(files,options={}){
  if(typeof files==='string')files=[{path:options.file||'source.cs',content:files}];
  const programs=[],diagnostics=[];
  for(const f of files){try{programs.push(new Parser(f.content,{file:f.path}).program());}catch(e){diagnostics.push(failure(e,f.path));}}
  if(diagnostics.length)return {ok:false,code:'',diagnostics,classes:[]};
  try{return new Emitter(programs,options).emit();}catch(e){return {ok:false,code:'',diagnostics:[failure(e)],classes:[]};}
}
