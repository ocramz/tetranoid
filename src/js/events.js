// A tiny synchronous event bus: the rules emit what happened, and sound, haptics,
// particles, screens and the wake lock react. Handlers run immediately, in order.
const handlers = new Map();

/** Subscribe to `type`; returns a function that unsubscribes. */
export function on(type, fn){
  if(!handlers.has(type)) handlers.set(type, []);
  handlers.get(type).push(fn);
  return () => {
    const list = handlers.get(type), i = list.indexOf(fn);
    if(i >= 0) list.splice(i, 1);
  };
}

export function emit(type, data){
  const list = handlers.get(type);
  if(list) for(const fn of [...list]) fn(data);
}
