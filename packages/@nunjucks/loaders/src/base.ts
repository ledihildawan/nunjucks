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
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  emit: (event: string, ...args: unknown[]) => void;
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
}

export function createLoader(opts: LoaderOptions = {}): Loader {
  const emitter = new EventEmitter();

  const resolve = opts.resolve ?? ((from: string, to: string) => path.resolve(path.dirname(from), to));
  const isRelative = opts.isRelative ?? ((filename: string) => filename.startsWith('./') || filename.startsWith('../'));

  const loader: Loader = {
    [LoaderSymbol]: true,
    resolve,
    isRelative,

    on(event: string, handler: (...args: unknown[]) => void) {
      emitter.on(event, handler);
    },
    emit(event: string, ...args: unknown[]) {
      emitter.emit(event, ...args);
    },
    removeListener(event: string, handler: (...args: unknown[]) => void) {
      emitter.removeListener(event, handler);
    },
  };

  return loader;
}

export const isLoader = (obj: unknown): obj is Loader =>
  Boolean(obj && typeof obj === 'object' && LoaderSymbol in obj);
