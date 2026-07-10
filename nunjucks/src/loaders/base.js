import EventEmitter from 'events';
import { resolve, dirname } from 'node:path';

function Loader(opts) {
  if (!(this instanceof Loader)) {
    return new Loader(opts);
  }
  EventEmitter.call(this);
  this.typename = 'Loader';
  this.resolve = function(from, to) {
    return resolve(dirname(from), to);
  };
  this.isRelative = function(filename) {
    return (filename.indexOf('./') === 0 || filename.indexOf('../') === 0);
  };
}

Loader.prototype = Object.create(EventEmitter.prototype);

export function createLoader(opts) {
  return new Loader(opts);
}

export { Loader as default };
