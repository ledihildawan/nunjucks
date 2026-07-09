import { makeMacro } from '../runtime/index.js';

export const abs = Math.abs;

export function isNaN(num) {
  return num !== num;
}

export function round(val, precision, method) {
  precision = precision || 0;
  const factor = Math.pow(10, precision);
  let rounder;

  if (method === 'ceil') {
    rounder = Math.ceil;
  } else if (method === 'floor') {
    rounder = Math.floor;
  } else {
    rounder = Math.round;
  }

  return rounder(val * factor) / factor;
}

export function float(val, def) {
  var res = parseFloat(val);
  return (isNaN(res)) ? def : res;
}

export const intFilter = makeMacro(
  ['value', 'default', 'base'],
  [],
  function doInt(value, defaultValue, base = 10) {
    var res = parseInt(value, base);
    return (isNaN(res)) ? defaultValue : res;
  }
);

export const int = intFilter;
