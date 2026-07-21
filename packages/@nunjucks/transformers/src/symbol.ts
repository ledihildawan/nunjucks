// SYMBOL - Generate unique symbols/identifiers
// Import directly: import { createGensym } from '@nunjucks/transformers/symbol'

export const createSymbolGenerator = (seed = 0, prefix = 'hole'): (() => string) => {
  let counter = seed;
  return () => `${prefix}_${counter++}`;
};

export const createGensym = (prefix = 'hole'): (() => string) => {
  const gen = createSymbolGenerator(0, prefix);
  return () => gen();
};
