/** One debugger UI, multiple isolated runtimes. Context changes never merge tasks or breakpoints. */
export function createDebugContext(source, binary) {
  let current = source, disposed = false;
  const listeners = new Set();
  const emit = message => {for (const callback of [...listeners]) callback(message);};
  const unsubscribe = [source, binary].map(session => session.subscribe(message => {if (session === current && !disposed) emit(message);}));
  return {
    select(kind) {
      const next = kind === 'binary' ? binary : source;
      if (current === next) return;
      current = next;emit({event:'workspace-reset',payload:{}});
      const paused = current.state().paused;
      if (paused) emit({event:'debug-paused',payload:paused});
    },
    get kind() {return current === binary ? 'binary' : 'source';},
    state: () => current.state(), options: () => current.options(), tasks: () => current.tasks?.() ?? [],
    command: (...args) => current.command(...args), inspectFrame: (...args) => current.inspectFrame(...args),
    setLocal: (...args) => current.setLocal(...args), watch: (...args) => current.watch(...args),
    toggleBreakpoint: (...args) => current.toggleBreakpoint(...args), clearBreakpoints: () => current.clearBreakpoints(),
    breakpointBound: (...args) => current.breakpointBound(...args), selectTask: (...args) => current.selectTask(...args),
    subscribe(callback) {listeners.add(callback);return () => listeners.delete(callback);},
    dispose() {disposed = true;unsubscribe.forEach(fn => fn());listeners.clear();}
  };
}
