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
      if (!handlers) {
        // WHY: unlike Node's EventEmitter (which throws on unhandled 'error'), silently
        // dropping a watcher error here would leave the watch cache stale with no observable
        // trace — surface a fallback log so the failure is never fully swallowed.
        if (event === 'error') {
          // biome-ignore lint/suspicious/noConsole: loaders are the fs shell — this is the last-resort log when no error listener is attached.
          console.warn('[nunjucks loader] unhandled watcher error:', ...args);
        }
        return;
      }
      // WHY: imperative sequence, not a pipeline — emit orchestrates independent
      // side-effecting handlers in registration order; no data flows between them.
      for (const handler of [...handlers]) {
        handler(...args);
      }
    },
  };
};
