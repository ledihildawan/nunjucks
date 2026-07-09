import { isArray, keys } from 'remeda';

export async function asyncEach(arr, dimen, iter) {
  if (isArray(arr)) {
    const len = arr.length;

    for (let i = 0; i < len; i++) {
      const item = arr[i];
      switch (dimen) {
        case 1:
          await iter(item, i, len);
          break;
        case 2:
          await iter(item[0], item[1], i, len);
          break;
        case 3:
          await iter(item[0], item[1], item[2], i, len);
          break;
        default:
          item.push(i, len);
          await iter.apply(this, item);
      }
    }
  } else {
    const kys = keys(arr || {});
    const len = kys.length;
    for (let i = 0; i < len; i++) {
      const k = kys[i];
      await iter(k, arr[k], i, len);
    }
  }
}

export async function asyncAll(arr, dimen, func) {
  const outputArr = [];

  if (isArray(arr)) {
    const len = arr.length;

    if (len === 0) {
      return '';
    }

    for (let i = 0; i < len; i++) {
      const item = arr[i];

      switch (dimen) {
        case 1:
          outputArr[i] = await func(item, i, len);
          break;
        case 2:
          outputArr[i] = await func(item[0], item[1], i, len);
          break;
        case 3:
          outputArr[i] = await func(item[0], item[1], item[2], i, len);
          break;
        default:
          item.push(i, len);
          outputArr[i] = await func.apply(this, item);
      }
    }
  } else {
    const kys = keys(arr || {});
    const len = kys.length;

    if (len === 0) {
      return '';
    }

    for (let i = 0; i < len; i++) {
      const k = kys[i];
      outputArr[i] = await func(k, arr[k], i, len);
    }
  }

  return outputArr.join('');
}
