/** Instanced WebGPU rectangle/rounded-rectangle/ellipse renderer with Canvas2D fallback. */
export async function createDrawingSurface(initialCanvas,{onStatus=()=>{},onCanvasReplace=()=>{},preferGPU=true,maxPrimitives=100000}={}) {
  let canvas=initialCanvas,device=null,context=null,pipeline=null,uniform=null,storage=null,bindGroup=null,capacity=0,disposed=false,observer=null;
  let lastScene=[],lastClear=[0,0,0,0];const stats={backend:'initializing',drawCalls:0,primitiveCount:0,lastFrameMs:0};
  const shader=`
struct Primitive { bounds: vec4f, color: vec4f, options: vec4f }
struct Viewport { size: vec2f, pad: vec2f }
@group(0) @binding(0) var<storage, read> primitives: array<Primitive>;
@group(0) @binding(1) var<uniform> viewport: Viewport;
struct VertexOutput { @builtin(position) position: vec4f, @location(0) uv: vec2f, @location(1) @interpolate(flat) index: u32 }
@vertex fn vertexMain(@builtin(vertex_index) vertex: u32, @builtin(instance_index) instance: u32) -> VertexOutput {
  var corners = array<vec2f, 6>(vec2f(0,0),vec2f(1,0),vec2f(0,1),vec2f(0,1),vec2f(1,0),vec2f(1,1));
  let uv=corners[vertex]; let p=primitives[instance]; let pixel=p.bounds.xy+uv*p.bounds.zw;
  var out: VertexOutput; out.position=vec4f(pixel.x/viewport.size.x*2-1,1-pixel.y/viewport.size.y*2,0,1);out.uv=uv;out.index=instance;return out;
}
@fragment fn fragmentMain(in: VertexOutput) -> @location(0) vec4f {
  let p=primitives[in.index]; let halfSize=p.bounds.zw*0.5;
  let radius=min(p.options.x,min(halfSize.x,halfSize.y));
  let q=abs((in.uv-vec2f(0.5))*p.bounds.zw)-(halfSize-vec2f(radius));
  var distance=length(max(q,vec2f(0)))+min(max(q.x,q.y),0)-radius;
  if(p.options.y>0.5){distance=(length((in.uv-vec2f(0.5))*2)-1)*min(halfSize.x,halfSize.y);}
  let coverage=1-smoothstep(-max(fwidth(distance),0.5),max(fwidth(distance),0.5),distance);
  return vec4f(p.color.rgb,p.color.a*coverage);
}`;
  function dimensions(){const logicalWidth=Math.max(1,canvas.clientWidth||canvas.width||600),logicalHeight=Math.max(1,canvas.clientHeight||canvas.height||240),dpr=Math.min(globalThis.devicePixelRatio||1,3);const width=Math.round(logicalWidth*dpr),height=Math.round(logicalHeight*dpr);if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;return {logicalWidth,logicalHeight,dpr};}
  function validate(scene,clear){
    if(!Array.isArray(scene)||scene.length>maxPrimitives)throw new RangeError(`Scene must contain no more than ${maxPrimitives} primitives`);
    if(!Array.isArray(clear)||clear.length!==4||!clear.every(Number.isFinite))throw new TypeError('Clear color must have four finite components');
    for(const p of scene){if(![p.x,p.y,p.width,p.height,...(p.color||[])].every(Number.isFinite)||p.width<0||p.height<0||p.color?.length!==4)throw new TypeError('A primitive requires finite bounds and an RGBA color');}
  }
  function allocate(count){
    if(count<=capacity)return;storage?.destroy();capacity=Math.max(64,2**Math.ceil(Math.log2(count)));
    storage=device.createBuffer({size:capacity*48,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
    bindGroup=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:storage}},{binding:1,resource:{buffer:uniform}}]});
  }
  function fallback(reason){
    if(context&&stats.backend==='webgpu'){const next=canvas.cloneNode(false);canvas.replaceWith(next);canvas=next;onCanvasReplace(next);}
    context=canvas.getContext('2d');if(!context)throw new Error('Neither WebGPU nor Canvas2D is available');
    stats.backend='canvas2d';onStatus({backend:'canvas2d',message:`Canvas2D fallback: ${reason}`});
  }
  if(preferGPU&&globalThis.navigator?.gpu){
    try{
      const adapter=await navigator.gpu.requestAdapter();if(!adapter)throw new Error('No compatible GPU adapter');
      device=await adapter.requestDevice();context=canvas.getContext('webgpu');if(!context)throw new Error('WebGPU canvas context unavailable');
      const format=navigator.gpu.getPreferredCanvasFormat();context.configure({device,format,alphaMode:'premultiplied'});stats.backend='webgpu';
      device.pushErrorScope('validation');
      const module=device.createShaderModule({code:shader,label:'Jailbreak primitive shader'});
      pipeline=await device.createRenderPipelineAsync({label:'Jailbreak batched primitives',layout:'auto',vertex:{module,entryPoint:'vertexMain'},fragment:{module,entryPoint:'fragmentMain',targets:[{format,blend:{color:{srcFactor:'src-alpha',dstFactor:'one-minus-src-alpha'},alpha:{srcFactor:'one',dstFactor:'one-minus-src-alpha'}}}]},primitive:{topology:'triangle-list'}});
      const error=await device.popErrorScope();if(error)throw new Error(error.message);
      uniform=device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
      device.lost.then(info=>{if(disposed)return;try{fallback(`Device lost: ${info.message}`);render(lastScene,lastClear);}catch(e){onStatus({backend:'lost',message:e.message});}});
      onStatus({backend:'webgpu',message:'WebGPU instanced primitive renderer initialized'});
    }catch(e){fallback(e.message);}
  }else fallback(preferGPU?'WebGPU is unavailable in this context':'Canvas2D explicitly selected');
  function render(scene,clear=[0,0,0,0]){
    if(disposed)return;
    if(typeof clear==='string'){
      const hex=clear.replace(/^#/, '');
      if(!/^(?:[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex))throw new TypeError('Clear color must be #RRGGBB, Avalonia #AARRGGBB, or an RGBA array');
      const rgb=hex.length===8?hex.slice(2):hex;
      clear=[parseInt(rgb.slice(0,2),16)/255,parseInt(rgb.slice(2,4),16)/255,parseInt(rgb.slice(4,6),16)/255,hex.length===8?parseInt(hex.slice(0,2),16)/255:1];
    }
    validate(scene,clear);lastScene=scene;lastClear=clear;const start=performance.now(),{logicalWidth:w,logicalHeight:h,dpr}=dimensions();
    if(stats.backend==='webgpu'){
      allocate(Math.max(1,scene.length));const data=new Float32Array(scene.length*12);
      scene.forEach((p,i)=>data.set([p.x,p.y,p.width,p.height,...p.color,p.radius||0,p.kind==='ellipse'?1:0,0,0],i*12));
      device.queue.writeBuffer(uniform,0,new Float32Array([w,h,0,0]));if(data.length)device.queue.writeBuffer(storage,0,data);
      const encoder=device.createCommandEncoder(),pass=encoder.beginRenderPass({colorAttachments:[{view:context.getCurrentTexture().createView(),clearValue:{r:clear[0],g:clear[1],b:clear[2],a:clear[3]},loadOp:'clear',storeOp:'store'}]});
      if(scene.length){pass.setPipeline(pipeline);pass.setBindGroup(0,bindGroup);pass.draw(6,scene.length);}pass.end();device.queue.submit([encoder.finish()]);stats.drawCalls=scene.length?1:0;
    }else{
      context.setTransform(dpr,0,0,dpr,0,0);context.clearRect(0,0,w,h);context.fillStyle=`rgba(${clear.slice(0,3).map(x=>x*255).join(',')},${clear[3]})`;context.fillRect(0,0,w,h);
      for(const p of scene){context.fillStyle=`rgba(${p.color.slice(0,3).map(x=>x*255).join(',')},${p.color[3]})`;context.beginPath();if(p.kind==='ellipse')context.ellipse(p.x+p.width/2,p.y+p.height/2,p.width/2,p.height/2,0,0,Math.PI*2);else context.roundRect(p.x,p.y,p.width,p.height,Math.max(0,p.radius||0));context.fill();}stats.drawCalls=scene.length;
    }
    stats.primitiveCount=scene.length;stats.lastFrameMs=performance.now()-start;
  }
  if(globalThis.ResizeObserver){observer=new ResizeObserver(()=>{if(!disposed)render(lastScene,lastClear);});observer.observe(canvas);}
  return {get canvas(){return canvas;},stats,render,resize:()=>render(lastScene,lastClear),dispose(){if(disposed)return;disposed=true;observer?.disconnect();storage?.destroy();uniform?.destroy();if(stats.backend==='webgpu')context.unconfigure();device?.destroy();}};
}
