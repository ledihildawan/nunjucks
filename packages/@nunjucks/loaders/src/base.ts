export const LoaderSymbol = Symbol('Loader');

export interface Loader {
  readonly [LoaderSymbol]: true;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  emit: (event: string, ...args: unknown[]) => void;
}

type Listener = (...args: unknown[]) => void;

export const createLoader = (): Loader => {
  const listeners: Record<string, Set<Listener>> = {};

  return {
    [LoaderSymbol]: true,

    on(event: string, handler: Listener): void {
      const set = listeners[event] ?? new Set<Listener>();
      listeners[event] = set;
      set.add(handler);
    },

    emit(event: string, ...args: unknown[]): void {
      listeners[event]?.forEach((handler) => { handler(...args); });
    },
  };
};

export const isLoader = (value: unknown): value is Loader =>
  Boolean(value && typeof value === 'object' && LoaderSymbol in value);
