/** Opt-in, credential-free, bounded retrieval. Metadata cannot grant network access. */
const integer=(n,fallback,min,max,name)=>{n??=fallback;if(!Number.isSafeInteger(n)||n<min||n>max)throw new RangeError('Invalid '+name+' budget');return n;};
export function checkedUrl(value,{allowLocalHttp=false}={}){
  if(typeof value!=='string'||value.length>8192||/[\x00-\x20\\]/.test(value))throw new Error('Invalid restoration URL');
  const url=new URL(value);const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if(url.protocol!=='https:'&&!(allowLocalHttp&&local&&url.protocol==='http:'))throw new Error('Restoration requires HTTPS (loopback HTTP needs explicit approval)');
  if(url.username||url.password||url.hash)throw new Error('Restoration URL must not contain credentials or a fragment');
  return url;
}
export function approvedOrigins(input=[],options={}){
  if(!Array.isArray(input)||input.length>32)throw new RangeError('At most 32 restoration origins may be approved');
  return new Set(input.map(value=>{const u=checkedUrl(value,options);if(u.pathname!=='/'||u.search)throw new Error('Approve an exact source origin, not a path or query');return u.origin;}));
}
export function createDownloadSession(options={}){
  if(options.consent!==true)throw new Error('Explicit consent is required before downloading symbols or source');
  const fetcher=options.fetch??globalThis.fetch;if(typeof fetcher!=='function')throw new Error('No fetch implementation is available');
  const maxRequests=integer(options.maxRequests,64,1,256,'request'),maxBytes=integer(options.maxBytes,32*1024*1024,1,128*1024*1024,'download byte'),timeoutMs=integer(options.timeoutMs,20000,1,120000,'timeout');
  const controller=new AbortController(),requests=[];let total=0,closed=false;
  const abort=()=>controller.abort(options.signal?.reason??new Error('Symbol restoration cancelled'));
  if(options.signal?.aborted)abort();else options.signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>controller.abort(new Error('Symbol restoration timed out')),timeoutMs);
  function check(){if(closed)throw new Error('Download session is closed');controller.signal.throwIfAborted();}
  async function cancellable(promise){check();let cancel;const aborted=new Promise((_,reject)=>{cancel=()=>reject(controller.signal.reason);controller.signal.addEventListener('abort',cancel,{once:true});});try{return await Promise.race([promise,aborted]);}finally{controller.signal.removeEventListener('abort',cancel);}}
  return {
    async get(value,origins,limit=maxBytes){
      check();const url=checkedUrl(value,options);if(!origins.has(url.origin))throw new Error('Origin is not approved: '+url.origin);
      if(requests.length>=maxRequests)throw new RangeError('Symbol restoration request budget exceeded');
      limit=integer(limit,maxBytes,1,128*1024*1024,'file byte');const entry={url:url.href,status:'pending',bytes:0};requests.push(entry);
      let response,reader;
      try{
        response=await cancellable(Promise.resolve(fetcher(url.href,{method:'GET',mode:'cors',credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer',signal:controller.signal})));
        check();if(response.redirected||response.type==='opaque'||response.type==='opaqueredirect'||response.url&&new URL(response.url).href!==url.href)throw new Error('Redirected or opaque symbol responses are not accepted');
        if(response.status===404){entry.status='not-found';await response.body?.cancel().catch(()=>{});return null;}
        if(!response.ok)throw new Error('Restoration HTTP '+response.status);
        const length=response.headers.get('content-length');
        if(length!==null&&(!/^\d+$/.test(length)||Number(length)>Math.min(limit,maxBytes-total)))throw new RangeError('Download content length exceeds budget');
        if(!response.body?.getReader)throw new Error('A streaming response body is required');
        reader=response.body.getReader();const chunks=[];let size=0;
        while(true){const {done,value}=await cancellable(reader.read());if(done)break;
          if(!(value instanceof Uint8Array))throw new Error('Invalid byte stream');
          size+=value.length;total+=value.length;entry.bytes=size;
          if(size>limit||total>maxBytes)throw new RangeError('Symbol restoration byte budget exceeded');chunks.push(value);
        }
        check();const data=new Uint8Array(size);let at=0;for(const chunk of chunks){data.set(chunk,at);at+=chunk.length;}entry.status='downloaded';return data;
      }catch(error){entry.status='failed';throw error;}finally{if(reader){await reader.cancel().catch(()=>{});reader.releaseLock();}else await response?.body?.cancel().catch(()=>{});}
    },
    check,
    report:()=>({requests:requests.map(r=>({...r})),downloadedBytes:total}),
    close(){if(closed)return;closed=true;clearTimeout(timer);options.signal?.removeEventListener('abort',abort);controller.abort();}
  };
}
