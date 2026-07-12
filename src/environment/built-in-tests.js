import { isSafeString } from '../runtime/index.js';
import { isPlainObject, isFunction, isString as isStringCheck, isNumber, isArray, isDefined, isTruthy } from 'remeda';

export function callable(value) {
  return isFunction(value);
}

export function defined(value) {
  return isDefined(value);
}

export function divisibleby(one, two) {
  return (one % two) === 0;
}

export function escaped(value) {
  return isSafeString(value);
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
  return !isTruthy(value);
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

export function isLowerCase(value) {
  return value.toLowerCase() === value;
}

export function ne(one, two) {
  return one !== two;
}

export function nullTest(value) {
  return value === null;
}

export function number(value) {
  return isNumber(value);
}

export function odd(value) {
  return value % 2 === 1;
}

export function isString(value) {
  return isStringCheck(value);
}

export function truthy(value) {
  return isTruthy(value);
}

export function undefinedTest(value) {
  return !isDefined(value);
}

export function isUpperCase(value) {
  return value.toUpperCase() === value;
}

export function iterable(value) {
  if (typeof Symbol !== 'undefined') {
    return !!value[Symbol.iterator];
  } else {
    return isArray(value) || isStringCheck(value);
  }
}

export function mapping(value) {
  if (typeof Set !== 'undefined') {
    return isPlainObject(value) && !(value instanceof Set);
  }
  return isPlainObject(value);
}
