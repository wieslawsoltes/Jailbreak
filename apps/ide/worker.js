import {compileWorkspaceInputs} from './packages/binary-project/workspace.js';
// Worker messages are plain data. Neither compiler executes the supplied application.
self.onmessage=async event=>{const {id,files,options}=event.data;try{const result=await compileWorkspaceInputs(files,options);self.postMessage({id,result});}catch(error){self.postMessage({id,result:{success:false,code:'',manifest:{},diagnostics:[{severity:'error',code:'JB4999',message:error.message,file:'workspace',line:1,column:1}],stats:{milliseconds:0,generatedBytes:0,files:0}}});}};
