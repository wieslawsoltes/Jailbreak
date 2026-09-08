import {debugSymbols} from '../portable-pdb/symbols.js';
import {BinaryError} from '../managed-pe/reader.js';
/** WeakMap identity permits only symbols validated against this exact assembly object. */
export function collectDebugMetadata(assemblies){
  const sites=[],sources=Object.create(null),byMethod=new Map();
  for(const assembly of assemblies){const data=debugSymbols(assembly);if(!data)continue;
    for(const [file,text]of Object.entries(data.sources)){
      if(Object.hasOwn(sources,file)&&sources[file]!==text)throw new BinaryError('Conflicting verified symbol source: '+file,0,'JB6504');sources[file]=text;
    }
    for(const method of data.methods){const record=assembly.methods.find(m=>m.token===method.token);if(!record?.body)continue;const entries=[];
      for(const p of method.points){if(p.hidden)continue;const doc=data.documents[p.document-1],text=sources[doc.name];let offset=0;
        if(text!==undefined){const lines=text.split('\n');if(p.line>lines.length||p.column>lines[p.line-1].length+1)throw new BinaryError('PDB source location outside original text',0,'JB6504');for(let i=1;i<p.line;i++)offset+=lines[i-1].length+1;offset+=Math.max(0,p.column-1);}
        const point={id:'il_'+sites.length,file:doc.name,line:p.line,column:Math.max(1,p.column),endLine:p.endLine,endColumn:p.endColumn,offset,ilOffset:p.offset,token:method.token,assembly:assembly.name,method:record.owner+'.'+record.name,language:'csharp',origin:'msil',cooperative:false};
        const visible=new Map();for(const scope of method.scopes)if(scope.start<=p.offset&&p.offset<scope.end)for(const variable of scope.variables)if(!variable.hidden)visible.set(variable.name,variable.slot);
        sites.push(point);entries.push({point,locals:[...visible].map(([name,slot])=>({name,slot}))});
      }byMethod.set(assembly.name+'|'+method.token,entries);
    }
  }return {sites,sources,byMethod};
}
