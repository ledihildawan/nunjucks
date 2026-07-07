import { keys_ } from './collections.js';

export async function asyncIter(arr, iter) {
  for (let i = 0; i < arr.length; i++) {
    await iter(arr[i], i);
  }
}

export async function asyncFor(obj, iter) {
  const keys = keys_(obj || {});
  const len = keys.length;
  for (let i = 0; i < len; i++) {
    const k = keys[i];
    await iter(k, obj[k], i, len);
  }
}
