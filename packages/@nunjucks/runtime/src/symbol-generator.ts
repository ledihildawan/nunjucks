
const createSymbolGenerator = (seed = 0, prefix = 'hole'): (() => string) => {
  let counter = seed;
  return (): string => {
    const result = `${prefix}_${counter}`;
    counter += 1;
    return result;
  };
};

export const createGensym = (prefix = 'hole'): (() => string) => createSymbolGenerator(0, prefix);
