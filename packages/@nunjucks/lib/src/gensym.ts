/**
 * Creates a symbol-name generator that emits `prefix_0`, `prefix_1`, ... on
 * each call. Each generator owns its counter, so distinct prefixes or
 * distinct factories never collide.
 */
export const createGensym = (prefix: string): (() => string) => {
  let counter = 0;
  return (): string => {
    const id = `${prefix}_${counter}`;
    counter += 1;
    return id;
  };
};
