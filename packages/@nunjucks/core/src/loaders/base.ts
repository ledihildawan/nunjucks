import EventEmitter from 'node:events';
import path from 'node:path';

export const LoaderSymbol = Symbol('Loader');

export interface LoaderOptions {
  readonly resolve?: (from: string, to: string) => string;
  readonly isRelative?: (filename: string) => boolean;
}

export interface Loader {
  readonly [LoaderSymbol]: true;
  readonly resolve: (from: string, to: string) => string;
  readonly isRelative: (filename: string) => boolean;
  on(event: string, handler: (...args: unknown[]) => void): void;
  emit(event: string, ...args: unknown[]): void;
  removeListener(event: string, handler: (...args: unknown[]) => void): void;
}

export function createLoader(opts: LoaderOptions = {}): Loader {
  const emitter = new EventEmitter();

  let _resolve = opts.resolve ?? ((from, to) => path.resolve(path.dirname(from), to));
  let _isRelative = opts.isRelative ?? ((filename) => filename.startsWith('./') || filename.startsWith('../'));

  const loader: Loader = {
    [LoaderSymbol]: true,
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

export const isLoader = (obj: unknown): obj is Loader =>
  Boolean(obj && typeof obj === 'object' && LoaderSymbol in obj);
