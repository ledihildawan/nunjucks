const createIdGenerator = (seed: number, prefix: string): (() => string) => {
  let counter = seed;
  return (): string => {
    const result = `${prefix}_${counter}`;
    counter += 1;
    return result;
  };
};

export const createGensym = (prefix: string): (() => string) => createIdGenerator(0, prefix);
