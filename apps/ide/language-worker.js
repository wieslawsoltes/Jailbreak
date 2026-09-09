import {LanguageWorkspace} from './packages/language-service/index.js';
const workspace=new LanguageWorkspace();
self.onmessage=({data})=>{
  try {
    const {id,action,files,file,offset,name}=data??{};
    if(!Number.isSafeInteger(id)||!files||typeof files!=='object'||Array.isArray(files)||typeof file!=='string')throw new Error('Invalid language-service request');
    workspace.update(files);let result;
    switch(action){
      case 'complete':result=workspace.complete(file,offset);break;
      case 'definition':case 'references':case 'describe':result=workspace[action](file,offset);break;
      case 'rename':result=workspace.rename(file,offset,name);break;
      default:throw new Error('Unknown source tooling command');
    }
    self.postMessage({id,result});
  }catch(error){self.postMessage({id:data?.id,error:String(error.message)});}
};
