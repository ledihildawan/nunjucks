
// SYMBOL - Generate unique symbols/identifiers
export const createSymbolGenerator = (seed = 0, prefix = 'hole'): (() => string) => {
  let counter = seed;
  return (): string => {
    const result = `${prefix}_${counter}`;
    counter += 1;
    return result;
  };
};

export const createGensym = (prefix = 'hole'): (() => string) => {
  const gen = createSymbolGenerator(0, prefix);
  return (): string => gen();
};
