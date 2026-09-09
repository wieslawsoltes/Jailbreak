/** Authenticated parent client for the isolated binary workspace. No source or runtime evaluation. */
export function createBinaryClient({send = () => {}, notify = () => {}} = {}) {
  const listeners = new Set(), tasks = new Map();
  let ready = false, compiled = false, busy = false, paused = null, frameId = null, debug = false, sites = [], sources = {}, points = [], watches = [];
  const emit = (event, payload = {}) => {for (const fn of [...listeners]) fn({event, payload});};
  const post = (action, payload = {}) => send(action, payload);
  function validatePaths(paths) {if (!Array.isArray(paths) || paths.length > 50 || paths.some(p => typeof p !== 'string' || p.length > 512)) throw new RangeError('Invalid watch paths');return paths;}
  const api = {
    receive(message) {
      const {event, payload} = message ?? {};
      if (typeof event !== 'string') return;
      if (event === 'binary-state') {
        ready = payload?.ready === true;compiled = payload?.compiled === true;debug = payload?.debug === true;busy = payload?.busy === true;
        if (Array.isArray(payload?.sites)) sites = payload.sites.slice(0,200000);
        if (payload?.sources && typeof payload.sources === 'object') sources = Object.fromEntries(Object.entries(payload.sources).filter(([k,v]) => k.length < 4096 && typeof v === 'string' && v.length <= 4000000).slice(0,2000));
        emit('settings');emit(event,{ready,compiled,debug,busy});return;
      }
      if (event === 'debug-started') busy = true;
      if (event === 'debug-paused') {
        if (!Number.isSafeInteger(payload?.taskId) || !Array.isArray(payload.frames) || payload.frames.length > 512) return;
        paused = payload;frameId = payload.frames[0]?.id ?? null;tasks.set(payload.taskId, payload);busy = true;
      } else if (event === 'debug-frame') {if (payload?.taskId !== paused?.taskId) return;frameId = payload.id;}
      else if (event === 'debug-resumed' || event === 'debug-completed') {
        tasks.delete(payload?.taskId);if (paused?.taskId === payload?.taskId) {paused = null;frameId = null;}
        if (event === 'debug-completed') busy = tasks.size > 0;
      } else if (event === 'session-stopped' || event === 'session-starting') {tasks.clear();paused = null;frameId = null;ready = false;busy = false;}
      else if (event === 'tool-error') notify(String(payload?.message ?? 'Binary command failed'));
      emit(event,payload);
    },
    state: () => ({ready, compiled, busy, paused, frame:frameId, settings:api.options()}),
    options: () => ({enabled:debug,cooperativeDebug:debug,nativeBreaks:false,hotReload:false,breakpoints:points,watches}),
    tasks: () => [...tasks.values()],
    selectTask(id) {const task = tasks.get(id);if (!task) throw new Error('No suspended binary task');paused = task;frameId = task.frames[0]?.id;emit('debug-paused',task);},
    command(action) {if (!paused && action !== 'cancel') throw new Error('No paused binary invocation');if (!['continue','into','over','out','cancel'].includes(action)) throw new Error('Unknown debugger command');post('debug-command',{taskId:paused?.taskId,action});},
    inspectFrame(id) {if (!paused || !paused.frames.some(f=>f.id===id)) throw new Error('Stale binary frame');frameId = id;post('debug-frame',{taskId:paused.taskId,frameId:id,paths:watches});},
    setLocal(name,value) {if (!paused || frameId == null) throw new Error('No paused binary frame');post('debug-local',{taskId:paused.taskId,frameId,name,value});},
    watch(paths) {watches = validatePaths(paths);if (paused) api.inspectFrame(frameId);emit('settings');},
    toggleBreakpoint(file,line) {
      if (typeof file !== 'string' || file.length > 4096 || !Number.isSafeInteger(line) || line < 1) throw new Error('Invalid source breakpoint');
      const at=points.findIndex(p=>p.file===file&&p.line===line);
      if(at>=0)points.splice(at,1);else {if(points.length>=1000)throw new RangeError('Breakpoint budget exceeded');points.push({file,line,enabled:true});}
      post('configure-debug',{settings:{breakpoints:points}});emit('settings');
    },
    clearBreakpoints() {points=[];post('configure-debug',{settings:{breakpoints:points}});emit('settings');},
    breakpointBound: (file,line) => compiled && sites.some(p=>p.file===file&&p.line===line),
    open(point) {post('source-location',{point});},
    mode(value) {if(!['release','cooperative','design','native'].includes(value))throw new Error('Invalid execution mode');if(value==='native')throw new Error('Use the In-IDE debugger for binary workspace stepping');post('mode',{debug:value==='cooperative'});},
    run(action='start') {post(action);},
    sources: () => sources,
    subscribe(fn) {listeners.add(fn);return () => listeners.delete(fn);},
    dispose() {listeners.clear();tasks.clear();}
  };
  return api;
}
