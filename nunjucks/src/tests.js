import { SafeString } from './runtime.js';

export function callable(value) {
  return typeof value === 'function';
}

export function defined(value) {
  return value !== undefined;
}

export function divisibleby(one, two) {
  return (one % two) === 0;
}

export function escaped(value) {
  return value instanceof SafeString;
}

export function equalto(one, two) {
  return one === two;
}

export const eq = equalto;
export const sameas = equalto;

export function even(value) {
  return value % 2 === 0;
}

export function falsy(value) {
  return !value;
}

export function ge(one, two) {
  return one >= two;
}

export function greaterthan(one, two) {
  return one > two;
}

export const gt = greaterthan;

export function le(one, two) {
  return one <= two;
}

export function lessthan(one, two) {
  return one < two;
}

export const lt = lessthan;

export function lower(value) {
  return value.toLowerCase() === value;
}

export function ne(one, two) {
  return one !== two;
}

export function nullTest(value) {
  return value === null;
}

export { nullTest as null };

export function number(value) {
  return typeof value === 'number';
}

export function odd(value) {
  return value % 2 === 1;
}

export function string(value) {
  return typeof value === 'string';
}

export function truthy(value) {
  return !!value;
}

export function undefinedTest(value) {
  return value === undefined;
}

export { undefinedTest as undefined };

export function upper(value) {
  return value.toUpperCase() === value;
}

export function iterable(value) {
  if (typeof Symbol !== 'undefined') {
    return !!value[Symbol.iterator];
  } else {
    return Array.isArray(value) || typeof value === 'string';
  }
}

export function mapping(value) {
  const bool = value !== null
    && value !== undefined
    && typeof value === 'object'
    && !Array.isArray(value);
  if (typeof Set !== 'undefined') {
    return bool && !(value instanceof Set);
  } else {
    return bool;
  }
}
