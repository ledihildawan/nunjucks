// WHY: shell-side time-based filter — simulates DB latency for streaming demo. Lives in lib/io/ because
// setTimeout is a side-effecting primitive (§2 Functional Core / Imperative Shell boundary).

/**
 * Delays ~350ms before stringifying — sized to sit comfortably between the
 * streaming demo's chunk cadence and its multi-second idle timeout.
 *
 * @param value - Any context value; coerced via `String`.
 * @returns The stringified value after the artificial latency.
 */
const slow = async (value: unknown): Promise<string> => {
  await new Promise((resolve) => {
    setTimeout(resolve, 350);
  });
  return String(value);
};

export { slow };
