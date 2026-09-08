/** WebGPU batched rectangle/ellipse rendering, with a real Canvas2D fallback. */
export function parseColor(value){
  if(Array.isArray(value)){if(value.length!==4||!value.every(Number.isFinite))throw new TypeError('Color requires four finite RGBA components');return value.map(x=>Math.max(0,Math.min(1,x)));}
  const text=String(value??'#4b8cff').trim();
  if(/^#[0-9a-f]{6}$/i.test(text))return [parseInt(text.slice(1,3),16)/255,parseInt(text.slice(3,5),16)/255,parseInt(text.slice(5,7),16)/255,1];
  if(/^#[0-9a-f]{8}$/i.test(text))return [parseInt(text.slice(3,5),16)/255,parseInt(text.slice(5,7),16)/255,parseInt(text.slice(7,9),16)/255,parseInt(text.slice(1,3),16)/255];
  if(/^#[0-9a-f]{3}$/i.test(text))return [...text.slice(1)].map(c=>parseInt(c+c,16)/255).concat(1);
  return [0.3,0.55,1,1];
}
const shader=`
struct View { size: vec2f, padding: vec2f };
struct Shape { rect: vec4f, color: vec4f, params: vec4f };
@group(0) @binding(0) var<uniform> view: View;
@group(0) @binding(1) var<storage,read> shapes: array<Shape>;
struct Out { @builtin(position) position: vec4f, @location(0) uv: vec2f, @location(1) size: vec2f, @location(2) color: vec4f, @location(3) params: vec2f };
@vertex fn vs(@builtin(vertex_index) vertex:u32,@builtin(instance_index) instance:u32)->Out {
  let points=array<vec2f,6>(vec2f(0,0),vec2f(1,0),vec2f(0,1),vec2f(0,1),vec2f(1,0),vec2f(1,1));
  let s=shapes[instance]; let uv=points[vertex]; let p=s.rect.xy+uv*s.rect.zw; var o:Out;
  o.position=vec4f(p/view.size*vec2f(2,-2)+vec2f(-1,1),0,1);o.uv=uv;o.size=s.rect.zw;o.color=s.color;o.params=s.params.xy;return o;
}
@fragment fn fs(i:Out)->@location(0) vec4f {
  let radius=min(i.params.x,min(i.size.x,i.size.y)*0.5);let q=abs((i.uv-0.5)*i.size)-(i.size*0.5-vec2f(radius));
  var d=length(max(q,vec2f(0)))+min(max(q.x,q.y),0)-radius;
  if(i.params.y>0.5){d=(length((i.uv-0.5)*2)-1)*min(i.size.x,i.size.y)*0.5;}
  let alpha=i.color.a*(1-smoothstep(-fwidth(d),fwidth(d),d));return vec4f(i.color.rgb*alpha,alpha);
}`;
export class PrimitiveSurface {
  constructor(host,{onStatus=()=>{},preferGpu=true}={}){this.host=host;this.onStatus=onStatus;this.preferGpu=preferGpu;this.commands=[];this.disposed=false;this.mode='initializing';this.capacity=0;this.dirty=false;this.canvas=document.createElement('canvas');this.canvas.style.cssText='width:100%;height:100%;display:block';host.append(this.canvas);this.resizeObserver=new ResizeObserver(()=>this.invalidate());this.resizeObserver.observe(host);this.ready=this.initialize();}
  async initialize(){
    try {
      if(!this.preferGpu||!navigator.gpu)throw new Error('WebGPU unavailable');
      const adapter=await navigator.gpu.requestAdapter();if(!adapter)throw new Error('No WebGPU adapter');
      this.device=await adapter.requestDevice();if(this.disposed){this.device.destroy();return;}
      const device=this.device;this.context=this.canvas.getContext('webgpu');if(!this.context)throw new Error('WebGPU canvas unavailable');
      this.format=navigator.gpu.getPreferredCanvasFormat();this.context.configure({device,format:this.format,alphaMode:'premultiplied'});
      const module=device.createShaderModule({code:shader});
      this.pipeline=await device.createRenderPipelineAsync({layout:'auto',vertex:{module,entryPoint:'vs'},fragment:{module,entryPoint:'fs',targets:[{format:this.format,blend:{color:{srcFactor:'one',dstFactor:'one-minus-src-alpha'},alpha:{srcFactor:'one',dstFactor:'one-minus-src-alpha'}}}]},primitive:{topology:'triangle-list'}});
      this.uniform=device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
      this.mode='webgpu';this.onStatus('WebGPU · instanced primitives');
      device.lost.then(info=>{if(!this.disposed&&this.mode==='webgpu')this.fallback('Device lost: '+info.message);});
    }catch(error){if(!this.disposed)this.fallback(error.message);}
    this.invalidate();return this.mode;
  }
  fallback(reason){this.buffer?.destroy();this.uniform?.destroy();this.device?.destroy();this.device=null;const next=document.createElement('canvas');next.style.cssText=this.canvas.style.cssText;this.canvas.replaceWith(next);this.canvas=next;this.context=next.getContext('2d');this.mode='canvas2d';this.onStatus('Canvas2D fallback · '+reason);this.invalidate();}
  setScene(commands){if(!Array.isArray(commands))throw new TypeError('Scene must be an array');if(commands.length>100000)throw new RangeError('Maximum 100,000 primitives');this.commands=commands.map(s=>{if(![s.x,s.y,s.width,s.height].every(Number.isFinite))throw new TypeError('Non-finite primitive geometry');if(s.width<0||s.height<0)throw new RangeError('Primitive dimensions cannot be negative');return {...s,color:parseColor(s.color),radius:Math.max(0,Number(s.radius)||0),ellipse:!!s.ellipse};});this.invalidate();}
  invalidate(){if(this.dirty||this.disposed)return;this.dirty=true;this.frame=requestAnimationFrame(()=>{this.dirty=false;this.draw();});}
  draw(){
    if(this.disposed||this.mode==='initializing')return;const r=this.host.getBoundingClientRect(),w=Math.max(1,r.width),h=Math.max(1,r.height),dpr=Math.min(3,globalThis.devicePixelRatio||1);
    const pw=Math.round(w*dpr),ph=Math.round(h*dpr);if(this.canvas.width!==pw||this.canvas.height!==ph){this.canvas.width=pw;this.canvas.height=ph;}
    if(this.mode==='canvas2d'){const ctx=this.context;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);for(const s of this.commands){const c=s.color;ctx.fillStyle=`rgba(${c[0]*255},${c[1]*255},${c[2]*255},${c[3]})`;ctx.beginPath();if(s.ellipse)ctx.ellipse(s.x+s.width/2,s.y+s.height/2,Math.max(0,s.width/2),Math.max(0,s.height/2),0,0,Math.PI*2);else ctx.roundRect(s.x,s.y,s.width,s.height,s.radius);ctx.fill();}return;}
    const device=this.device,count=this.commands.length,size=Math.max(48,count*48);
    if(size>this.capacity){this.buffer?.destroy();this.capacity=2**Math.ceil(Math.log2(size));this.buffer=device.createBuffer({size:this.capacity,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});this.bindGroup=device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.uniform}},{binding:1,resource:{buffer:this.buffer}}]});}
    const data=new Float32Array(count*12);this.commands.forEach((s,i)=>data.set([s.x,s.y,s.width,s.height,...s.color,s.radius,s.ellipse?1:0,0,0],i*12));
    device.queue.writeBuffer(this.uniform,0,new Float32Array([w,h,0,0]));if(count)device.queue.writeBuffer(this.buffer,0,data);
    const encoder=device.createCommandEncoder();const pass=encoder.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:'clear',storeOp:'store'}]});
    if(count){pass.setPipeline(this.pipeline);pass.setBindGroup(0,this.bindGroup);pass.draw(6,count);}pass.end();device.queue.submit([encoder.finish()]);
  }
  Dispose(){if(this.disposed)return;this.disposed=true;cancelAnimationFrame(this.frame);this.resizeObserver.disconnect();this.buffer?.destroy();this.uniform?.destroy();this.device?.destroy();this.canvas.remove();}
}
export function demoScene(width=720,height=340,count=3000,seed=17){let state=seed>>>0;const random=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};const palette=['#6589ff','#ac79ec','#45c9b4','#eeae66'];return Array.from({length:count},(_,i)=>({x:random()*Math.max(1,width-14),y:random()*Math.max(1,height-14),width:3+random()*9,height:3+random()*9,radius:2,ellipse:i%5===0,color:palette[i%4]}));}
