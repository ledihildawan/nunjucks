import EventEmitter from 'node:events';

export const LoaderSymbol = Symbol('Loader');

export interface Loader {
  readonly [LoaderSymbol]: true;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  emit: (event: string, ...args: unknown[]) => void;
}

export const createLoader = (): Loader => {
  const emitter = new EventEmitter();

  const loader: Loader = {
    [LoaderSymbol]: true,

    on(event: string, handler: (...args: unknown[]) => void) {
      emitter.on(event, handler);
    },
    emit(event: string, ...args: unknown[]) {
      emitter.emit(event, ...args);
    },
  };

  return loader;
};

export const isLoader = (value: unknown): value is Loader =>
  Boolean(value && typeof value === 'object' && LoaderSymbol in value);
