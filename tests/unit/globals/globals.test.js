import { expect, describe, test } from 'bun:test';
import * as util from '../../util.js';
import { Environment } from '../../../nunjucks/src/environment/index.js';

var equal = util.equal;
var render = util.render;

describe('global', function() {
  test('should have range', async function() {
    await equal('{% for i in range(0, 10) %}{{ i }}{% endfor %}', '0123456789');
    await equal('{% for i in range(10) %}{{ i }}{% endfor %}', '0123456789');
    await equal('{% for i in range(5, 10) %}{{ i }}{% endfor %}', '56789');
    await equal('{% for i in range(-2, 0) %}{{ i }}{% endfor %}', '-2-1');
    await equal('{% for i in range(5, 10, 2) %}{{ i }}{% endfor %}', '579');
    await equal('{% for i in range(5, 10, 2.5) %}{{ i }}{% endfor %}', '57.5');
    await equal('{% for i in range(5, 10, 2.5) %}{{ i }}{% endfor %}', '57.5');

    await equal('{% for i in range(10, 5, -1) %}{{ i }}{% endfor %}', '109876');
    await equal('{% for i in range(10, 5, -2.5) %}{{ i }}{% endfor %}', '107.5');
  });

  test('should have cycler', async function() {
    await equal(
      '{% set cls = cycler("odd", "even") %}' +
      '{{ cls.next() }}' +
      '{{ cls.next() }}' +
      '{{ cls.next() }}',
      'oddevenodd');

    await equal(
      '{% set cls = cycler("odd", "even") %}' +
      '{{ cls.next() }}' +
      '{{ cls.reset() }}' +
      '{{ cls.next() }}',
      'oddodd');

    await equal(
      '{% set cls = cycler("odd", "even") %}' +
      '{{ cls.next() }}' +
      '{{ cls.next() }}' +
      '{{ cls.current }}',
      'oddeveneven');
  });

  test('should have joiner', async function() {
    await equal(
      '{% set comma = joiner() %}' +
      'foo{{ comma() }}bar{{ comma() }}baz{{ comma() }}',
      'foobar,baz,');

    await equal(
      '{% set pipeChar = joiner("|") %}' +
      'foo{{ pipeChar() }}bar{{ pipeChar() }}baz{{ pipeChar() }}',
      'foobar|baz|');
  });

  test('should allow addition of globals', async function() {
    var env = new Environment();

    env.addGlobal('hello', function(arg1) {
      return 'Hello ' + arg1;
    });

    await equal('{{ hello("World!") }}', 'Hello World!', env);
  });

  test('should allow chaining of globals', async function() {
    var env = new Environment();

    env.addGlobal('hello', function(arg1) {
      return 'Hello ' + arg1;
    }).addGlobal('goodbye', function(arg1) {
      return 'Goodbye ' + arg1;
    });

    await equal('{{ hello("World!") }}', 'Hello World!', env);
    await equal('{{ goodbye("World!") }}', 'Goodbye World!', env);
  });

  test('should allow getting of globals', async function() {
    var env = new Environment();
    var hello = function(arg1) {
      return 'Hello ' + arg1;
    };

    env.addGlobal('hello', hello);

    expect(env.getGlobal('hello')).toEqual(hello);
  });

  test('should allow getting boolean globals', async function() {
    var env = new Environment();
    var hello = false;

    env.addGlobal('hello', hello);

    expect(env.getGlobal('hello')).toEqual(hello);
  });

  test('should fail on getting non-existent global', async function() {
    var env = new Environment();

    expect(function() {
      env.getGlobal('hello');
    }).toThrow();
  });

  test('should pass context as this to global functions', async function() {
    var env = new Environment();

    env.addGlobal('hello', function() {
      return 'Hello ' + this.lookup('user');
    });

    await equal('{{ hello() }}', {
      user: 'James'
    }, 'Hello James', env);
  });

  test('should be exclusive to each environment', async function() {
    var env = new Environment();
    var env2;

    env.addGlobal('hello', 'konichiwa');
    env2 = new Environment();

    expect(function() {
      env2.getGlobal('hello');
    }).toThrow();
  });

  test('should return errors from globals', async function() {
    var env = new Environment();
    env.addGlobal('err', function() {
      throw new Error('test error');
    });
    try {
      await render('{{ err() }}', null, {}, env);
      expect().toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
  });
});
