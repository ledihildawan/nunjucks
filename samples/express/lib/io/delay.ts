// WHY: latency simulation is shell I/O — setTimeout is a side-effecting primitive
// (§2 Functional Core / Imperative Shell boundary), mirroring slow-filter.ts's
// placement rationale, so remote-fragment routes await instead of nesting callbacks.

/**
 * Resolves after the given delay — used to simulate slow upstream fragments.
 *
 * @param ms - Milliseconds to wait before resolving.
 */
const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export { delay };
