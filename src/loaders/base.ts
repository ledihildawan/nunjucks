import EventEmitter from 'events';
import path from 'node:path';

export const Loader = Symbol('Loader');

export interface LoaderOptions {
  resolve?: (from: string, to: string) => string;
  isRelative?: (filename: string) => boolean;
}

export interface Loader {
  [Loader]: true;
  resolve: (from: string, to: string) => string;
  isRelative: (filename: string) => boolean;
  on(event: string, handler: (...args: unknown[]) => void): void;
  emit(event: string, ...args: unknown[]): void;
  removeListener(event: string, handler: (...args: unknown[]) => void): void;
}

export function createLoader(opts: LoaderOptions = {}): Loader {
  const emitter = new EventEmitter();

  let _resolve = opts.resolve ?? ((from, to) => path.resolve(path.dirname(from), to));
  let _isRelative = opts.isRelative ?? ((filename) => filename.startsWith('./') || filename.startsWith('../'));

  const loader: Loader = {
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

  return loader;
}

export const isLoader = (obj: unknown): obj is Loader => Boolean(obj && typeof obj === 'object' && Loader in obj);
