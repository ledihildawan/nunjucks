export const callable = value => typeof value === 'function';
export const defined = value => value !== undefined;
export const undefinedTest = value => value === undefined;
export const nullTest = value => value === null;
export const divisibleby = (value, divisor) => value % divisor === 0;
export const escaped = value => Boolean(value?.__nunjucksSafe);
export const even = value => value % 2 === 0;
export const odd = value => value % 2 === 1;
export const falsy = value => !value;
export const truthy = value => Boolean(value);
export const equalto = (value, other) => value === other;
export const sameas = (value, other) => value === other;
export const greaterthan = (value, other) => value > other;
export const ge = (value, other) => value >= other;
export const lessthan = (value, other) => value < other;
export const le = (value, other) => value <= other;
export const ne = (value, other) => value !== other;
export const lower = value => typeof value === 'string' && value === value.toLowerCase();
export const upper = value => typeof value === 'string' && value === value.toUpperCase();
export const number = value => typeof value === 'number';
export const string = value => typeof value === 'string';
export const iterable = value => value != null && typeof value[Symbol.iterator] === 'function';
export const mapping = value => value != null && typeof value === 'object' && !Array.isArray(value);

export const builtInTests = {
  callable,
  defined,
  undefined: undefinedTest,
  null: nullTest,
  none: nullTest,
  divisibleby,
  escaped,
  even,
  odd,
  falsy,
  truthy,
  equalto,
  eq: equalto,
  sameas,
  greaterthan,
  gt: greaterthan,
  ge,
  lessthan,
  lt: lessthan,
  le,
  ne,
  lower,
  upper,
  number,
  string,
  iterable,
  mapping,
};
