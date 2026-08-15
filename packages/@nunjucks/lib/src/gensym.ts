export const createGensym = (prefix: string): (() => string) => {
  let counter = 0;
  return (): string => {
    const id = `${prefix}_${counter}`;
    counter += 1;
    return id;
  };
};
