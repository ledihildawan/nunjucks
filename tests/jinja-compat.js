import { describe, test } from 'bun:test';
import * as util from './util.js';

var equal = util.jinjaEqual;

describe('jinja-compat', function() {
  var arr = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  test('should support array slices with start and stop', async function() {
    await equal('{% for i in arr[1:4] %}{{ i }}{% endfor %}',
      {
        arr: arr
      },
      'bcd');
  });
  test('should support array slices using expressions', async function() {
    await equal('{% for i in arr[n:n+3] %}{{ i }}{% endfor %}',
      {
        n: 1,
        arr: arr
      },
      'bcd');
  });
  test('should support array slices with start', async function() {
    await equal('{% for i in arr[3:] %}{{ i }}{% endfor %}',
      {
        arr: arr
      },
      'defgh');
  });
  test('should support array slices with negative start', async function() {
    await equal('{% for i in arr[-3:] %}{{ i }}{% endfor %}',
      {
        arr: arr
      },
      'fgh');
  });
  test('should support array slices with stop', async function() {
    await equal('{% for i in arr[:4] %}{{ i }}{% endfor %}',
      {
        arr: arr
      },
      'abcd');
  });
  test('should support array slices with negative stop', async function() {
    await equal('{% for i in arr[:-3] %}{{ i }}{% endfor %}',
      {
        arr: arr
      },
      'abcde');
  });
  test('should support array slices with step', async function() {
    await equal('{% for i in arr[::2] %}{{ i }}{% endfor %}',
      {
        arr: arr
      },
      'aceg');
  });
  test('should support array slices with negative step', async function() {
    await equal('{% for i in arr[::-1] %}{{ i }}{% endfor %}',
      {
        arr: arr
      },
      'hgfedcba');
  });
  test('should support array slices with start and negative step', async function() {
    await equal('{% for i in arr[4::-1] %}{{ i }}{% endfor %}',
      {
        arr: arr
      },
      'edcba');
  });
  test('should support array slices with negative start and negative step', async function() {
    await equal('{% for i in arr[-5::-1] %}{{ i }}{% endfor %}',
      {
        arr: arr
      },
      'dcba');
  });
  test('should support array slices with stop and negative step', async function() {
    await equal('{% for i in arr[:3:-1] %}{{ i }}{% endfor %}',
      {
        arr: arr
      },
      'hgfe');
  });
  test('should support array slices with start and step', async function() {
    await equal('{% for i in arr[1::2] %}{{ i }}{% endfor %}',
      {
        arr: arr
      },
      'bdfh');
  });
  test('should support array slices with start, stop, and step', async function() {
    await equal('{% for i in arr[1:7:2] %}{{ i }}{% endfor %}',
      {
        arr: arr
      },
      'bdf');
  });
});
