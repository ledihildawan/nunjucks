/** Brands an object as a `Loader`, keeping the structural type nominal. */
export const LoaderSymbol = Symbol('Loader');

/**
 * Defines the minimal loader contract: a `LoaderSymbol` brand plus the
 * `on`/`emit` event surface. Loaders are plain object literals, so no
 * foreign prototype ever crosses this boundary.
 */
export interface Loader {
  readonly [LoaderSymbol]: true;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  emit: (event: string, ...args: unknown[]) => void;
}

type Listener = (...args: unknown[]) => void;

/**
 * Creates the prototype-safe event-emitter core that concrete loaders
 * spread into their public objects. `emit` invokes a snapshot of each
 * event's handlers in registration order; an `error` event with no
 * listener degrades to a console warning rather than throwing.
 */
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
