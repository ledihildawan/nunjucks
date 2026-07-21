// SYMBOL - Generate unique symbols/identifiers
// Import directly: import { createGensym } from '@nunjucks/transformers/symbol'

export const createSymbolGenerator = (seed = 0, prefix = 'sym') => {
  let counter = seed;
  return () => `${prefix}_${counter++}`;
};

export const createGensym = (prefix = 'sym') => {
  const gen = createSymbolGenerator(0, prefix);
  return () => gen();
};
