import EventEmitter from 'events';
import path from 'node:path';

export function createLoader(opts = {}) {
  const emitter = new EventEmitter();

  let _typename = 'Loader';
  let _resolve = (from, to) => path.resolve(path.dirname(from), to);
  let _isRelative = (filename) => filename.indexOf('./') === 0 || filename.indexOf('../') === 0;

  return {
    get typename() { return _typename; },
    set typename(v) { _typename = v; },
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
}
