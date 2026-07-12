import EventEmitter from 'events';
import path from 'node:path';

const Loader = Symbol('Loader');

export function createLoader(opts = {}) {
  const emitter = new EventEmitter();

  let _resolve = (from, to) => path.resolve(path.dirname(from), to);
  let _isRelative = (filename) => filename.startsWith('./') || filename.startsWith('../');

  const loader = {
    [Loader]: true,
    get resolve() { return _resolve; },
    set resolve(v) { _resolve = v; },
    get isRelative() { return _isRelative; },
    set isRelative(v) { _isRelative = v; },

    on(event, handler) {
      emitter.on(event, handler);
    },
    emit(event, ...args) {
      emitter.emit(event, ...args);
    },
    removeListener(event, handler) {
      emitter.removeListener(event, handler);
    },
  };

  loader[Loader] = true;
  return loader;
}

export const isLoader = (obj) => obj?.[Loader] === true;
export { Loader };
