import { forEach } from 'remeda';

export const LoaderSymbol = Symbol('Loader');

export interface Loader {
  readonly [LoaderSymbol]: true;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  emit: (event: string, ...args: unknown[]) => void;
}

type Listener = (...args: unknown[]) => void;

export const createLoader = (): Loader => {
  const listeners = new Map<string, Set<Listener>>();

  return {
    [LoaderSymbol]: true,

    on(event: string, handler: Listener): void {
      const set = listeners.get(event) ?? new Set<Listener>();
      listeners.set(event, set);
      set.add(handler);
    },

    emit(event: string, ...args: unknown[]): void {
      const handlers = listeners.get(event);
      if (!handlers) { return; }
      forEach([...handlers], (handler) => { handler(...args); });
    },
  };
};

export const isLoader = (value: unknown): value is Loader =>
  Boolean(value && typeof value === 'object' && LoaderSymbol in value);
