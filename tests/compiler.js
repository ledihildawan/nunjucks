import { expect, describe, test } from 'bun:test';
import * as util from './util.js';
import { Template } from '../nunjucks/src/environment.js';
import { Environment } from '../nunjucks/src/environment.js';
import fs from 'fs';

var render = util.render;
var equal = util.equal;

var isSlim = util.isSlim;
var Loader = util.Loader;

describe('compiler', function() {
  test('should compile templates', async function() {
    await equal('Hello world', 'Hello world');
    await equal('Hello world, {{ name }}',
      {
        name: 'James'
      },
      'Hello world, James');

    await equal('Hello world, {{name}}{{suffix}}, how are you',
      {
        name: 'James',
        suffix: ' Long'
      },
      'Hello world, James Long, how are you');
  });

  test('should escape newlines', async function() {
    await equal('foo\\nbar', 'foo\\nbar');
  });

  test('should escape Unicode line seperators', async function() {
    await equal('\u2028', '\u2028');
  });

  test('should compile references', async function() {
    await equal('{{ foo.bar }}',
      {
        foo: {
          bar: 'baz'
        }
      },
      'baz');

    await equal('{{ foo["bar"] }}',
      {
        foo: {
          bar: 'baz'
        }
      },
      'baz');
  });

  test('should compile references - object without prototype', async function() {
    var context = Object.create(null);
    context.foo = Object.create(null);
    context.foo.bar = 'baz';

    await equal('{{ foo.bar }}',
      context,
      'baz');

    await equal('{{ foo["bar"] }}',
      context,
      'baz');
  });

  test('should fail silently on undefined values', async function() {
    await equal('{{ foo }}', '');
    await equal('{{ foo.bar }}', '');
    await equal('{{ foo.bar.baz }}', '');
    await equal('{{ foo.bar.baz["biz"].mumble }}', '');
  });

  test('should compile optional chaining', async function() {
    await equal('{{ foo?.bar }}',
      {
        foo: {
          bar: 'baz'
        }
      },
      'baz');

    await equal('{{ foo?.bar }}',
      {
        foo: null
      },
      '');

    await equal('{{ foo?.bar }}',
      {
        foo: undefined
      },
      '');

    await equal('{{ foo?.bar?.baz }}',
      {
        foo: {
          bar: {
            baz: 'qux'
          }
        }
      },
      'qux');

    await equal('{{ foo?.bar?.baz }}',
      {
        foo: {
          bar: null
        }
      },
      '');

    await equal('{{ foo?.bar?.baz }}',
      {
        foo: null
      },
      '');

    await equal('{{ foo?.bar }}',
      {
        foo: {
          bar: 'hello'
        }
      },
      'hello');
  });

  test('should compile nullish coalescing', async function() {
    await equal('{{ foo ?? "default" }}',
      {
        foo: null
      },
      'default');

    await equal('{{ foo ?? "default" }}',
      {
        foo: undefined
      },
      'default');

    await equal('{{ foo ?? "default" }}',
      {
        foo: 'value'
      },
      'value');

    await equal('{{ foo ?? bar ?? "default" }}',
      {
        foo: null,
        bar: null
      },
      'default');

    await equal('{{ foo ?? bar ?? "default" }}',
      {
        foo: null,
        bar: 'middle'
      },
      'middle');

    await equal('{{ foo ?? "default" }}',
      {
        foo: false
      },
      'false');

    await equal('{{ foo ?? "default" }}',
      {
        foo: 0
      },
      '0');

    await equal('{{ foo ?? "default" }}',
      {
        foo: ''
      },
      '');
  });

  test('should compile combined optional chaining and nullish coalescing', async function() {
    await equal('{{ foo?.bar ?? "default" }}',
      {
        foo: null
      },
      'default');

    await equal('{{ foo?.bar ?? "default" }}',
      {
        foo: {
          bar: 'baz'
        }
      },
      'baz');

    await equal('{{ foo?.bar ?? "default" }}',
      {
        foo: {
          bar: null
        }
      },
      'default');

    await equal('{{ foo?.bar?.baz ?? "default" }}',
      {
        foo: null
      },
      'default');

    await equal('{{ foo?.bar?.baz ?? "default" }}',
      {
        foo: {
          bar: {
            baz: 'qux'
          }
        }
      },
      'qux');
  });

  test('should not treat falsy values the same as undefined', async function() {
    await equal('{{ foo }}', {
      foo: 0
    }, '0');
    await equal('{{ foo }}', {
      foo: false
    }, 'false');
  });

  test('should display none as empty string', async function() {
    await equal('{{ none }}', '');
  });

  test('should compile none as falsy', async function() {
    await equal('{% if not none %}yes{% endif %}', 'yes');
  });

  test('should compile none as null, not undefined', async function() {
    await equal('{{ none|>default("d", false) }}', '');
  });

  test('should compile function calls', async function() {
    await equal('{{ foo("msg") }}',
      {
        foo: function(str) {
          return str + 'hi';
        }
      },
      'msghi');
  });

  test('should compile function calls with correct scope', async function() {
    await equal('{{ foo.bar() }}', {
      foo: {
        bar: function() {
          return this.baz;
        },
        baz: 'hello'
      }
    }, 'hello');
  });

  test('should compile switch statements', async function() {
    var tpl1 = '{% switch foo %}{% case "bar" %}BAR{% case "baz" %}BAZ{% default %}NEITHER FOO NOR BAR{% endswitch %}';
    var tpl2 = '{% switch foo %}{% case "bar" %}BAR{% case "baz" %}BAZ{% endswitch %}';
    var tpl3 = '{% switch foo %}{% case "bar" %}{% case "baz" %}BAR{% endswitch %}';
    await equal(tpl1, 'NEITHER FOO NOR BAR');
    await equal(tpl1, {
      foo: 'bar'
    }, 'BAR');
    await equal(tpl1, {
      foo: 'baz'
    }, 'BAZ');
    await equal(tpl2, '');
    await equal(tpl3, {
      foo: 'bar'
    }, 'BAR');
    await equal(tpl3, {
      foo: 'baz'
    }, 'BAR');
  });

  test('should compile if blocks', async function() {
    var tmpl = ('Give me some {% if hungry %}pizza' +
      '{% else %}water{% endif %}');

    await equal(tmpl, {
      hungry: true
    }, 'Give me some pizza');
    await equal(tmpl, {
      hungry: false
    }, 'Give me some water');
    await equal('{% if not hungry %}good{% endif %}',
      {
        hungry: false
      },
      'good');

    await equal('{% if hungry and like_pizza %}good{% endif %}',
      {
        hungry: true,
        like_pizza: true
      },
      'good');

    await equal('{% if hungry or like_pizza %}good{% endif %}',
      {
        hungry: false,
        like_pizza: true
      },
      'good');

    await equal('{% if (hungry or like_pizza) and anchovies %}good{% endif %}',
      {
        hungry: false,
        like_pizza: true,
        anchovies: true
      },
      'good');

    await equal(
      '{% if food == "pizza" %}pizza{% endif %}' +
      '{% if food =="beer" %}beer{% endif %}',
      {
        food: 'beer'
      },
      'beer');

    await equal('{% if "pizza" in food %}yum{% endif %}',
      {
        food: {
          pizza: true
        }
      },
      'yum');

    await equal('{% if pizza %}yum{% elif anchovies %}yuck{% endif %}',
      {
        pizza: true
      },
      'yum');

    await equal('{% if pizza %}yum{% elseif anchovies %}yuck{% endif %}',
      {
        pizza: true
      },
      'yum');

    await equal('{% if pizza %}yum{% elif anchovies %}yuck{% endif %}',
      {
        anchovies: true
      },
      'yuck');

    await equal('{% if pizza %}yum{% elseif anchovies %}yuck{% endif %}',
      {
        anchovies: true
      },
      'yuck');

    await equal(
      '{% if topping == "pepperoni" %}yum{% elseif topping == "anchovies" %}' +
      'yuck{% else %}hmmm{% endif %}',
      {
        topping: 'sausage'
      },
      'hmmm');
  });

  test('should compile the ternary operator', async function() {
    await equal('{{ "foo" if bar else "baz" }}', 'baz');
    await equal('{{ "foo" if bar else "baz" }}', {
      bar: true
    }, 'foo');
  });

  test('should compile inline conditionals', async function() {
    var tmpl = 'Give me some {{ "pizza" if hungry else "water" }}';

    await equal(tmpl, {
      hungry: true
    }, 'Give me some pizza');
    await equal(tmpl, {
      hungry: false
    }, 'Give me some water');
    await equal('{{ "good" if not hungry }}',
      {
        hungry: false
      }, 'good');
    await equal('{{ "good" if hungry and like_pizza }}',
      {
        hungry: true,
        like_pizza: true
      }, 'good');
    await equal('{{ "good" if hungry or like_pizza }}',
      {
        hungry: false,
        like_pizza: true
      }, 'good');
    await equal('{{ "good" if (hungry or like_pizza) and anchovies }}',
      {
        hungry: false,
        like_pizza: true,
        anchovies: true
      }, 'good');
    await equal(
      '{{ "pizza" if food == "pizza" }}' +
      '{{ "beer" if food == "beer" }}',
      {
        food: 'beer'
      }, 'beer');
  });

  function runLoopTests(block) {
    var end = {
      asyncAll: 'endall',
      asyncEach: 'endeach',
      for: 'endfor'
    }[block];

    describe('the ' + block + ' tag', function() {
      test('should loop over simple arrays', async function() {
        await equal(
          '{% ' + block + ' i in arr %}{{ i }}{% ' + end + ' %}',
          { arr: [1, 2, 3, 4, 5] },
          '12345');
      });
      test('should loop normally with an {% else %} tag and non-empty array', async function() {
        await equal(
          '{% ' + block + ' i in arr %}{{ i }}{% else %}empty{% ' + end + ' %}',
          { arr: [1, 2, 3, 4, 5] },
          '12345');
      });
      test('should execute the {% else %} block when looping over an empty array', async function() {
        await equal(
          '{% ' + block + ' i in arr %}{{ i }}{% else %}empty{% ' + end + ' %}',
          { arr: [] },
          'empty');
      });
      test('should support destructured looping', async function() {
        await equal(
          '{% ' + block + ' a, b, c in arr %}' +
          '{{ a }},{{ b }},{{ c }}.{% ' + end + ' %}',
          { arr: [['x', 'y', 'z'], ['1', '2', '3']] },
          'x,y,z.1,2,3.');
      });
      test('should do loop over key-values of a literal in-template Object', async function() {
        await equal(
          '{% ' + block + ' k, v in { one: 1, two: 2 } %}' +
          '-{{ k }}:{{ v }}-{% ' + end + ' %}', '-one:1--two:2-');
      });
      test('should support loop.index', async function() {
        await equal('{% ' + block + ' i in [7,3,6] %}{{ loop.index }}{% ' + end + ' %}', '123');
      });
      test('should support loop.index0', async function() {
        await equal('{% ' + block + ' i in [7,3,6] %}{{ loop.index0 }}{% ' + end + ' %}', '012');
      });
      test('should support loop.revindex', async function() {
        await equal('{% ' + block + ' i in [7,3,6] %}{{ loop.revindex }}{% ' + end + ' %}', '321');
      });
      test('should support loop.revindex0', async function() {
        await equal('{% ' + block + ' i in [7,3,6] %}{{ loop.revindex0 }}{% ' + end + ' %}', '210');
      });
      test('should support loop.first', async function() {
        await equal(
          '{% ' + block + ' i in [7,3,6] %}' +
          '{% if loop.first %}{{ i }}{% endif %}' +
          '{% ' + end + ' %}',
          '7');
      });
      test('should support loop.last', async function() {
        await equal(
          '{% ' + block + ' i in [7,3,6] %}' +
          '{% if loop.last %}{{ i }}{% endif %}' +
          '{% ' + end + ' %}',
          '6');
      });
      test('should support loop.length', async function() {
        await equal('{% ' + block + ' i in [7,3,6] %}{{ loop.length }}{% ' + end + ' %}', '333');
      });
      test('should fail silently when looping over an undefined variable', async function() {
        await equal('{% ' + block + ' i in foo %}{{ i }}{% ' + end + ' %}', '');
      });
      test('should fail silently when looping over an undefined property', async function() {
        await equal(
          '{% ' + block + ' i in foo.bar %}{{ i }}{% ' + end + ' %}',
          { foo: {} },
          '');
      });
      test('should fail silently when looping over a null variable', async function() {
        await equal(
          '{% ' + block + ' i in foo %}{{ i }}{% ' + end + ' %}',
          { foo: null },
          '');
      });
      test('should loop over two-dimensional arrays', async function() {
        await equal('{% ' + block + ' x, y in points %}[{{ x }},{{ y }}]{% ' + end + ' %}',
          { points: [[1, 2], [3, 4], [5, 6]] },
          '[1,2][3,4][5,6]');
      });
      test('should loop over four-dimensional arrays', async function() {
        await equal(
          '{% ' + block + ' a, b, c, d in arr %}[{{ a }},{{ b }},{{ c }},{{ d }}]{% ' + end + '%}',
          { arr: [[1, 2, 3, 4], [5, 6, 7, 8]] },
          '[1,2,3,4][5,6,7,8]');
      });
      test('should support loop.index with two-dimensional loops', async function() {
        await equal('{% ' + block + ' x, y in points %}{{ loop.index }}{% ' + end + ' %}',
          {
            points: [[1, 2], [3, 4], [5, 6]]
          },
          '123');
      });
      test('should support loop.revindex with two-dimensional loops', async function() {
        await equal('{% ' + block + ' x, y in points %}{{ loop.revindex }}{% ' + end + ' %}',
          {
            points: [[1, 2], [3, 4], [5, 6]]
          },
          '321');
      });
      test('should support key-value looping over an Object variable', async function() {
        await equal('{% ' + block + ' k, v in items %}({{ k }},{{ v }}){% ' + end + ' %}',
          {
            items: {
              foo: 1,
              bar: 2
            }
          },
          '(foo,1)(bar,2)');
      });
      test('should support loop.index when looping over an Object\'s key-value pairs', async function() {
        await equal('{% ' + block + ' k, v in items %}{{ loop.index }}{% ' + end + ' %}',
          {
            items: {
              foo: 1,
              bar: 2
            }
          },
          '12');
      });
      test('should support loop.revindex when looping over an Object\'s key-value pairs', async function() {
        await equal('{% ' + block + ' k, v in items %}{{ loop.revindex }}{% ' + end + ' %}',
          {
            items: {
              foo: 1,
              bar: 2
            }
          },
          '21');
      });
      test('should support loop.length when looping over an Object\'s key-value pairs', async function() {
        await equal('{% ' + block + ' k, v in items %}{{ loop.length }}{% ' + end + ' %}',
          {
            items: {
              foo: 1,
              bar: 2
            }
          },
          '22');
      });
      test('should support include tags in the body of the loop', async function() {
        await equal('{% ' + block + ' item, v in items %}{% include "item.njk" %}{% ' + end + ' %}',
          {
            items: {
              foo: 1,
              bar: 2
            }
          },
          'showing fooshowing bar');
      });
      test('should work with {% set %} and {% include %} tags', async function() {
        await equal(
          '{% set item = passed_var %}' +
          '{% include "item.njk" %}\n' +
          '{% ' + block + ' i in passed_iter %}' +
          '{% set item = i %}' +
          '{% include "item.njk" %}\n' +
          '{% ' + end + ' %}',
          {
            passed_var: 'test',
            passed_iter: ['1', '2', '3']
          },
          'showing test\nshowing 1\nshowing 2\nshowing 3\n');
      });
      test('should work with Set builtin', async function() {
        await equal('{% ' + block + ' i in set %}{{ i }}{% ' + end + ' %}',
          { set: new Set([1, 2, 3, 4, 5]) },
          '12345');

        await equal('{% ' + block + ' i in set %}{{ i }}{% else %}empty{% ' + end + ' %}',
          { set: new Set([1, 2, 3, 4, 5]) },
          '12345');

        await equal('{% ' + block + ' i in set %}{{ i }}{% else %}empty{% ' + end + ' %}',
          { set: new Set() },
          'empty');
      });
      test('should work with Map builtin', async function() {
        await equal('{% ' + block + ' k, v in map %}[{{ k }},{{ v }}]{% ' + end + ' %}',
          { map: new Map([[1, 2], [3, 4], [5, 6]]) },
          '[1,2][3,4][5,6]');

        await equal('{% ' + block + ' k, v in map %}[{{ k }},{{ v }}]{% else %}empty{% ' + end + ' %}',
          { map: new Map([[1, 2], [3, 4], [5, 6]]) },
          '[1,2][3,4][5,6]');

        await equal('{% ' + block + ' k, v in map %}[{{ k }},{{ v }}]{% else %}empty{% ' + end + ' %}',
          { map: new Map() },
          'empty');
      });
    });
  }

  runLoopTests('for');
  runLoopTests('asyncEach');
  runLoopTests('asyncAll');

  test('should allow overriding var with none inside nested scope', async function() {
    await equal(
      '{% set var = "foo" %}' +
      '{% for i in [1] %}{% set var = none %}{{ var }}{% endfor %}',
      '');
  });

  test('should compile async control', async function() {
    var opts = {
      asyncFilters: {
        getContents: function(tmpl, cb) {
          fs.readFile(tmpl, cb);
        },

        getContentsArr: function(arr, cb) {
          fs.readFile(arr[0], function(err, res) {
            cb(err, [res]);
          });
        }
      }
    };

    {
      const res = await new Promise((resolve, reject) => {
        render('{{ tmpl |> getContents }}',
          {
            tmpl: 'tests/templates/for-async-content.njk'
          },
          opts,
          function(err, res) {
            if (err) reject(err);
            else resolve(res);
          });
      });
      expect(res).toBe('somecontenthere');
    }

    {
      const res = await new Promise((resolve, reject) => {
        render('{% if tmpl %}{{ tmpl |> getContents }}{% endif %}',
          {
            tmpl: 'tests/templates/for-async-content.njk'
          },
          opts,
          function(err, res) {
            if (err) reject(err);
            else resolve(res);
          });
      });
      expect(res).toBe('somecontenthere');
    }

    {
      const res = await new Promise((resolve, reject) => {
        render('{% if tmpl |> getContents %}yes{% endif %}',
          {
            tmpl: 'tests/templates/for-async-content.njk'
          },
          opts,
          function(err, res) {
            if (err) reject(err);
            else resolve(res);
          });
      });
      expect(res).toBe('yes');
    }

    {
      const res = await new Promise((resolve, reject) => {
        render('{% for t in [tmpl, tmpl] %}{{ t |> getContents }}*{% endfor %}',
          {
            tmpl: 'tests/templates/for-async-content.njk'
          },
          opts,
          function(err, res) {
            if (err) reject(err);
            else resolve(res);
          });
      });
      expect(res).toBe('somecontenthere*somecontenthere*');
    }

    {
      const res = await new Promise((resolve, reject) => {
        render('{% for t in [tmpl, tmpl] |> getContentsArr %}{{ t }}{% endfor %}',
          {
            tmpl: 'tests/templates/for-async-content.njk'
          },
          opts,
          function(err, res) {
            if (err) reject(err);
            else resolve(res);
          });
      });
      expect(res).toBe('somecontenthere');
    }

    {
      const res = await new Promise((resolve, reject) => {
        render('{% if test %}{{ tmpl |> getContents }}{% endif %}oof',
          {
            tmpl: 'tests/templates/for-async-content.njk'
          },
          opts,
          function(err, res) {
            if (err) reject(err);
            else resolve(res);
          });
      });
      expect(res).toBe('oof');
    }

    {
      const res = await new Promise((resolve, reject) => {
        render(
          '{% if tmpl %}' +
          '{% for i in [0, 1] %}{{ tmpl |> getContents }}*{% endfor %}' +
          '{% endif %}',
          {
            tmpl: 'tests/templates/for-async-content.njk'
          },
          opts,
          function(err, res) {
            if (err) reject(err);
            else resolve(res);
          });
      });
      expect(res).toBe('somecontenthere*somecontenthere*');
    }

    {
      const res = await new Promise((resolve, reject) => {
        render('{% block content %}{{ tmpl |> getContents }}{% endblock %}',
          {
            tmpl: 'tests/templates/for-async-content.njk'
          },
          opts,
          function(err, res) {
            if (err) reject(err);
            else resolve(res);
          });
      });
      expect(res).toBe('somecontenthere');
    }

    {
      const res = await new Promise((resolve, reject) => {
        render('{% block content %}hello{% endblock %} {{ tmpl |> getContents }}',
          {
            tmpl: 'tests/templates/for-async-content.njk'
          },
          opts,
          function(err, res) {
            if (err) reject(err);
            else resolve(res);
          });
      });
      expect(res).toBe('hello somecontenthere');
    }

    {
      const res = await new Promise((resolve, reject) => {
        render('{% block content %}{% set foo = tmpl |> getContents %}{{ foo }}{% endblock %}',
          {
            tmpl: 'tests/templates/for-async-content.njk'
          },
          opts,
          function(err, res) {
            if (err) reject(err);
            else resolve(res);
          });
      });
      expect(res).toBe('somecontenthere');
    }

    {
      const res = await new Promise((resolve, reject) => {
        render('{% block content %}{% include "async.njk" %}{% endblock %}',
          {
            tmpl: 'tests/templates/for-async-content.njk'
          },
          opts,
          function(err, res) {
            if (err) reject(err);
            else resolve(res);
          });
      });
      expect(res).toBe('somecontenthere\n');
    }

    {
      const res = await new Promise((resolve, reject) => {
        render('{% asyncEach i in [0, 1] %}{% include "async.njk" %}{% endeach %}',
          {
            tmpl: 'tests/templates/for-async-content.njk'
          },
          opts,
          function(err, res) {
            if (err) reject(err);
            else resolve(res);
          });
      });
      expect(res).toBe('somecontenthere\nsomecontenthere\n');
    }

    {
      const res = await new Promise((resolve, reject) => {
        render('{% asyncAll i in [0, 1, 2, 3, 4] %}-{{ i }}:{% include "async.njk" %}-{% endall %}',
          {
            tmpl: 'tests/templates/for-async-content.njk'
          },
          opts,
          function(err, res) {
            if (err) reject(err);
            else resolve(res);
          });
      });
      expect(res).toBe('-0:somecontenthere\n-' +
        '-1:somecontenthere\n-' +
        '-2:somecontenthere\n-' +
        '-3:somecontenthere\n-' +
        '-4:somecontenthere\n-');
    }
  });

  test('should compile basic arithmetic operators', async function() {
    await equal('{{ 3 + 4 - 5 * 6 / 10 }}', '4');
  });

  test('should compile the exponentiation (**) operator', async function() {
    await equal('{{ 4**5 }}', '1024');
  });

  test('should compile the integer division (//) operator', async function() {
    await equal('{{ 9//5 }}', '1');
  });

  test('should compile the modulus operator', async function() {
    await equal('{{ 9%5 }}', '4');
  });

  test('should compile numeric negation operator', async function() {
    await equal('{{ -5 }}', '-5');
  });

  test('should compile comparison operators', async function() {
    await equal('{% if 3 < 4 %}yes{% endif %}', 'yes');
    await equal('{% if 3 > 4 %}yes{% endif %}', '');
    await equal('{% if 9 >= 10 %}yes{% endif %}', '');
    await equal('{% if 10 >= 10 %}yes{% endif %}', 'yes');
    await equal('{% if 9 <= 10 %}yes{% endif %}', 'yes');
    await equal('{% if 10 <= 10 %}yes{% endif %}', 'yes');
    await equal('{% if 11 <= 10 %}yes{% endif %}', '');

    await equal('{% if 10 != 10 %}yes{% endif %}', '');
    await equal('{% if 10 == 10 %}yes{% endif %}', 'yes');

    await equal('{% if "0" == 0 %}yes{% endif %}', 'yes');
    await equal('{% if "0" === 0 %}yes{% endif %}', '');
    await equal('{% if "0" !== 0 %}yes{% endif %}', 'yes');
    await equal('{% if 0 == false %}yes{% endif %}', 'yes');
    await equal('{% if 0 === false %}yes{% endif %}', '');

    await equal('{% if foo(20) > bar %}yes{% endif %}',
      {
        foo: function(n) {
          return n - 1;
        },
        bar: 15
      },
      'yes');
  });

  test('should compile python-style ternary operators', async function() {
    await equal('{{ "yes" if 1 is odd else "no"  }}', 'yes');
    await equal('{{ "yes" if 2 is even else "no"  }}', 'yes');
    await equal('{{ "yes" if 2 is odd else "no"  }}', 'no');
    await equal('{{ "yes" if 1 is even else "no"  }}', 'no');
  });

  test('should compile the "in" operator for Arrays', async function() {
    await equal('{% if 1 in [1, 2] %}yes{% endif %}', 'yes');
    await equal('{% if 1 in [2, 3] %}yes{% endif %}', '');
    await equal('{% if 1 not in [1, 2] %}yes{% endif %}', '');
    await equal('{% if 1 not in [2, 3] %}yes{% endif %}', 'yes');
    await equal('{% if "a" in vals %}yes{% endif %}',
      { vals: ['a', 'b'] },
      'yes');
  });

  test('should compile the "in" operator for objects', async function() {
    await equal('{% if "a" in obj %}yes{% endif %}',
      { obj: { a: true } },
      'yes');
    await equal('{% if "a" in obj %}yes{% endif %}',
      { obj: { b: true } },
      '');
  });

  test('should compile the "in" operator for strings', async function() {
    await equal('{% if "foo" in "foobar" %}yes{% endif %}', 'yes');
  });

  test('should throw an error when using the "in" operator on unexpected types', async function() {
    {
      const res = await new Promise((resolve, reject) => {
        render(
          '{% if "a" in 1 %}yes{% endif %}',
          {},
          {
            noThrow: true
          },
          function(err, res) {
            if (err) resolve({err, res});
            else resolve({err, res});
          }
        );
      });
      expect(res.res).toBe(undefined);
      expect(res.err.message).toMatch(
        /Cannot use "in" operator to search for "a" in unexpected types\./
      );
    }

    {
      const res = await new Promise((resolve, reject) => {
        render(
          '{% if "a" in obj %}yes{% endif %}',
          {},
          {
            noThrow: true
          },
          function(err, res) {
            if (err) resolve({err, res});
            else resolve({err, res});
          }
        );
      });
      expect(res.res).toBe(undefined);
      expect(res.err.message).toMatch(
        /Cannot use "in" operator to search for "a" in unexpected types\./
      );
    }
  });

  if (!isSlim) {
    test('should throw exceptions when called synchronously', async function() {
      var tmpl = new Template('{% from "doesnotexist" import foo %}');
      try {
        await tmpl.render();
        throw new Error('Expected exception was not thrown');
      } catch (err) {
        expect(err.message).toMatch(/template not found: doesnotexist/);
      }
    });

    test('should include error line in raised TemplateError', async function() {
      var tmplStr = [
        '{% set items = ["a", "b",, "c"] %}',
        '{{ items |> join(",") }}',
      ].join('\n');

      var loader = new Loader('tests/templates');
      var env = new Environment(loader);
      var tmpl = new Template(tmplStr, env, 'parse-error.njk');

      let res;
      let err;
      try {
        res = await tmpl.render({});
      } catch (e) {
        err = e;
      }
      expect(res).toBe(undefined);
      expect(err.toString()).toBe([
        'Template render error: (parse-error.njk) [Line 1, Column 26]',
        '  unexpected token: ,',
      ].join('\n'));
    });

    test('should include error line when exception raised in user function', async function() {
      var tmplStr = [
        '{% block content %}',
        '<div>{{ foo() }}</div>',
        '{% endblock %}',
      ].join('\n');
      var env = new Environment(new Loader('tests/templates'));
      var tmpl = new Template(tmplStr, env, 'user-error.njk');

      function foo() {
        throw new Error('ERROR');
      }

      let res;
      let err;
      try {
        res = await tmpl.render({foo: foo});
      } catch (e) {
        err = e;
      }
      expect(res).toBe(undefined);
      expect(err.toString()).toBe([
        'Template render error: (user-error.njk) [Line 1, Column 11]',
        '  Error: ERROR',
      ].join('\n'));
    });
  }

  test('should throw exceptions from included templates when called synchronously', async function() {
    try {
      await render('{% include "broken-import.njk" %}', {str: 'abc'});
      throw new Error('Expected exception was not thrown');
    } catch (err) {
      expect(err.message).toMatch(/template not found: doesnotexist/);
    }
  });

  test('should pass errors from included templates to callback when async', async function() {
    const res = await new Promise((resolve, reject) => {
      render(
        '{% include "broken-import.njk" %}',
        {str: 'abc'},
        {noThrow: true},
        function(err, res) {
          if (err) resolve({err, res});
          else resolve({err, res});
        });
    });
    expect(res.err.message).toMatch(/template not found: doesnotexist/);
    expect(res.res).toBe(undefined);
  });

  test('should compile string concatenations with tilde', async function() {
    await equal('{{ 4 ~ \'hello\' }}', '4hello');
    await equal('{{ 4 ~ 5 }}', '45');
    await equal('{{ \'a\' ~ \'b\' ~ 5 }}', 'ab5');
  });

  test('should compile macros', async function() {
    await equal(
      '{% macro foo() %}This is a macro{% endmacro %}' +
      '{{ foo() }}',
      'This is a macro');
  });

  test('should compile macros with optional args', async function() {
    await equal(
      '{% macro foo(x, y) %}{{ y }}{% endmacro %}' +
      '{{ foo(1) }}',
      '');
  });

  test('should compile macros with args that can be passed to filters', async function() {
    await equal(
      '{% macro foo(x) %}{{ x|>title }}{% endmacro %}' +
      '{{ foo("foo") }}',
      'Foo');
  });

  test('should compile macros with positional args', async function() {
    await equal(
      '{% macro foo(x, y) %}{{ y }}{% endmacro %}' +
      '{{ foo(1, 2) }}',
      '2');
  });

  test('should compile macros with arg defaults', async function() {
    await equal(
      '{% macro foo(x, y, z=5) %}{{ y }}{% endmacro %}' +
      '{{ foo(1, 2) }}',
      '2');
    await equal(
      '{% macro foo(x, y, z=5) %}{{ z }}{% endmacro %}' +
      '{{ foo(1, 2) }}',
      '5');
  });

  test('should compile macros with keyword args', async function() {
    await equal(
      '{% macro foo(x, y, z=5) %}{{ y }}{% endmacro %}' +
      '{{ foo(1, y=2) }}',
      '2');
  });

  test('should compile macros with only keyword args', async function() {
    await equal(
      '{% macro foo(x, y, z=5) %}{{ x }}{{ y }}{{ z }}' +
      '{% endmacro %}' +
      '{{ foo(x=1, y=2) }}',
      '125');
  });

  test('should compile macros with keyword args overriding defaults', async function() {
    await equal(
      '{% macro foo(x, y, z=5) %}{{ x }}{{ y }}{{ z }}' +
      '{% endmacro %}' +
      '{{ foo(x=1, y=2, z=3) }}',
      '123');
  });

  test('should compile macros with out-of-order keyword args', async function() {
    await equal(
      '{% macro foo(x, y=2, z=5) %}{{ x }}{{ y }}{{ z }}' +
      '{% endmacro %}' +
      '{{ foo(1, z=3) }}',
      '123');
  });

  test('should compile macros', async function() {
    await equal(
      '{% macro foo(x, y=2, z=5) %}{{ x }}{{ y }}{{ z }}' +
      '{% endmacro %}' +
      '{{ foo(1) }}',
      '125');
  });

  test('should compile macros with multiple overridden arg defaults', async function() {
    await equal(
      '{% macro foo(x, y=2, z=5) %}{{ x }}{{ y }}{{ z }}' +
      '{% endmacro %}' +
      '{{ foo(1, 10, 20) }}',
      '11020');
  });

  test('should compile macro calls inside blocks', async function() {
    await equal(
      '{% extends "base.njk" %}' +
      '{% macro foo(x, y=2, z=5) %}{{ x }}{{ y }}{{ z }}' +
      '{% endmacro %}' +
      '{% block block1 %}' +
      '{{ foo(1) }}' +
      '{% endblock %}',
      'Foo125BazFizzle');
  });

  test('should compile macros defined in one block and called in another', async function() {
    await equal(
      '{% block bar %}' +
      '{% macro foo(x, y=2, z=5) %}{{ x }}{{ y }}{{ z }}' +
      '{% endmacro %}' +
      '{% endblock %}' +
      '{% block baz %}' +
      '{{ foo(1) }}' +
      '{% endblock %}',
      '125');
  });

  test('should compile macros that include other templates', async function() {
    await equal(
      '{% macro foo() %}{% include "include.njk" %}{% endmacro %}' +
      '{{ foo() }}',
      {
        name: 'james'
      },
      'FooInclude james');
  });

  test('should compile macros that set vars', async function() {
    await equal(
      '{% macro foo() %}{% set x = "foo"%}{{ x }}{% endmacro %}' +
      '{% set x = "bar" %}' +
      '{{ x }}' +
      '{{ foo() }}' +
      '{{ x }}',
      'barfoobar');
  });

  test('should not leak variables set in macro to calling scope', async function() {
    await equal(
      '{% macro setFoo() %}' +
      '{% set x = "foo" %}' +
      '{{ x }}' +
      '{% endmacro %}' +
      '{% macro display() %}' +
      '{% set x = "bar" %}' +
      '{{ setFoo() }}' +
      '{{ x }}' +
      '{% endmacro %}' +
      '{{ display() }}',
      'foobar');
  });

  test('should not leak variables set in nested scope within macro out to calling scope', async function() {
    await equal(
      '{% macro setFoo() %}' +
      '{% for y in [1] %}{% set x = "foo" %}{{ x }}{% endfor %}' +
      '{% endmacro %}' +
      '{% macro display() %}' +
      '{% set x = "bar" %}' +
      '{{ setFoo() }}' +
      '{{ x }}' +
      '{% endmacro %}' +
      '{{ display() }}',
      'foobar');
  });

  test('should compile macros without leaking set to calling scope', async function() {
    await equal(
      '{% macro foo(topLevel, prefix="") %}' +
      '{% if topLevel %}' +
      '{% set x = "" %}' +
      '{% for i in [1,2] %}' +
      '{{ foo(false, x) }}' +
      '{% endfor %}' +
      '{% else %}' +
      '{% set x = prefix + "foo" %}' +
      '{{ x }}' +
      '{% endif %}' +
      '{% endmacro %}' +
      '{{ foo(true) }}',
      'foofoo');
  });

  test('should compile macros that cannot see variables in caller scope', async function() {
    await equal(
      '{% macro one(var) %}{{ two() }}{% endmacro %}' +
      '{% macro two() %}{{ var }}{% endmacro %}' +
      '{{ one("foo") }}',
      '');
  });

  test('should compile call blocks', async function() {
    await equal(
      '{% macro wrap(el) %}' +
      '<{{ el }}>{{ caller() }}</{{ el }}>' +
      '{% endmacro %}' +
      '{% call wrap("div") %}Hello{% endcall %}',
      '<div>Hello</div>');
  });

  test('should compile call blocks with args', async function() {
    await equal(
      '{% macro list(items) %}' +
      '<ul>{% for i in items %}' +
      '<li>{{ caller(i) }}</li>' +
      '{% endfor %}</ul>' +
      '{% endmacro %}' +
      '{% call(item) list(["a", "b"]) %}{{ item }}{% endcall %}',
      '<ul><li>a</li><li>b</li></ul>');
  });

  test('should compile call blocks using imported macros', async function() {
    await equal(
      '{% import "import.njk" as imp %}' +
      '{% call imp.wrap("span") %}Hey{% endcall %}',
      '<span>Hey</span>');
  });

  test('should import templates', async function() {
    await equal(
      '{% import "import.njk" as imp %}' +
      '{{ imp.foo() }} {{ imp.bar }}',
      'Here\'s a macro baz');

    await equal(
      '{% from "import.njk" import foo as baz, bar %}' +
      '{{ bar }} {{ baz() }}',
      'baz Here\'s a macro');

    await equal(
      '{% for i in [1,2] %}' +
      'start: {{ num }}' +
      '{% from "import.njk" import bar as num %}' +
      'end: {{ num }}' +
      '{% endfor %}' +
      'final: {{ num }}',
      'start: end: bazstart: bazend: bazfinal: ');
  });

  test('should import templates with context', async function() {
    await equal(
      '{% set bar = "BAR" %}' +
      '{% import "import-context.njk" as imp with context %}' +
      '{{ imp.foo() }}',
      'Here\'s BAR');

    await equal(
      '{% set bar = "BAR" %}' +
      '{% from "import-context.njk" import foo with context %}' +
      '{{ foo() }}',
      'Here\'s BAR');

    await equal(
      '{% set bar = "BAR" %}' +
      '{% import "import-context-set.njk" as imp %}' +
      '{{ bar }}',
      'BAR');

    await equal(
      '{% set bar = "BAR" %}' +
      '{% import "import-context-set.njk" as imp %}' +
      '{{ imp.bar }}',
      'FOO');

    await equal(
      '{% set bar = "BAR" %}' +
      '{% import "import-context-set.njk" as imp with context %}' +
      '{{ bar }}{{ buzz }}',
      'FOO');

    await equal(
      '{% set bar = "BAR" %}' +
      '{% import "import-context-set.njk" as imp with context %}' +
      '{{ imp.bar }}{{ buzz }}',
      'FOO');

    
  });

  test('should import templates without context', async function() {
    await equal(
      '{% set bar = "BAR" %}' +
      '{% import "import-context.njk" as imp without context %}' +
      '{{ imp.foo() }}',
      'Here\'s ');

    await equal(
      '{% set bar = "BAR" %}' +
      '{% from "import-context.njk" import foo without context %}' +
      '{{ foo() }}',
      'Here\'s ');

    
  });

  test('should default to importing without context', async function() {
    await equal(
      '{% set bar = "BAR" %}' +
      '{% import "import-context.njk" as imp %}' +
      '{{ imp.foo() }}',
      'Here\'s ');

    await equal(
      '{% set bar = "BAR" %}' +
      '{% from "import-context.njk" import foo %}' +
      '{{ foo() }}',
      'Here\'s ');

    
  });

  test('should inherit templates', async function() {
    await equal('{% extends "base.njk" %}', 'FooBarBazFizzle');
    await equal('hola {% extends "base.njk" %} hizzle mumble', 'FooBarBazFizzle');

    await equal('{% extends "base.njk" %}{% block block1 %}BAR{% endblock %}',
      'FooBARBazFizzle');

    await equal(
      '{% extends "base.njk" %}' +
      '{% block block1 %}BAR{% endblock %}' +
      '{% block block2 %}BAZ{% endblock %}',
      'FooBARBAZFizzle');

    await equal('hola {% extends tmpl %} hizzle mumble',
      { tmpl: 'base.njk' },
      'FooBarBazFizzle');

    
  });
  test('should not call blocks not defined from template inheritance', async function() {
    var count = 0;
    render(
      '{% extends "base.njk" %}' +
      '{% block notReal %}{{ foo() }}{% endblock %}',
      { foo: function() { count++; } },
      function() {
        expect(count).toBe(0);
      });

    
  });

  test('should conditionally inherit templates', async function() {
    await equal(
      '{% if false %}{% extends "base.njk" %}{% endif %}' +
      '{% block block1 %}BAR{% endblock %}',
      'BAR');

    await equal(
      '{% if true %}{% extends "base.njk" %}{% endif %}' +
      '{% block block1 %}BAR{% endblock %}',
      'FooBARBazFizzle');

    await equal(
      '{% if true %}' +
      '{% extends "base.njk" %}' +
      '{% else %}' +
      '{% extends "base2.njk" %}' +
      '{% endif %}' +
      '{% block block1 %}HELLO{% endblock %}',
      'FooHELLOBazFizzle');

    await equal(
      '{% if false %}' +
      '{% extends "base.njk" %}' +
      '{% else %}' +
      '{% extends "base2.njk" %}' +
      '{% endif %}' +
      '{% block item %}hello{{ item }}{% endblock %}',
      'hello1hello2');

    
  });

  test('should error if same block is defined multiple times', async function() {
    try {
      await render(
        '{% extends "simple-base.njk" %}' +
        '{% block test %}{% endblock %}' +
        '{% block test %}{% endblock %}');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err.message).toMatch(/Block "test" defined more than once./);
    }
  });

  test('should render nested blocks in child template', async function() {
    await equal(
      '{% extends "base.njk" %}' +
      '{% block block1 %}{% block nested %}BAR{% endblock %}{% endblock %}',
      'FooBARBazFizzle');

    
  });

  test('should render parent blocks with super()', async function() {
    await equal(
      '{% extends "base.njk" %}' +
      '{% block block1 %}{{ super() }}BAR{% endblock %}',
      'FooBarBARBazFizzle');

    await equal(
      '{% extends "base-inherit.njk" %}' +
      '{% block block1 %}*{{ super() }}*{% endblock %}',
      'Foo**Bar**BazFizzle');

    
  });

  test('should let super() see global vars from child template', async function() {
    await equal(
      '{% extends "base-show.njk" %}{% set var = "child" %}' +
      '{% block main %}{{ super() }}{% endblock %}',
      'child');

    
  });

  test('should not let super() see vars from child block', async function() {
    await equal(
      '{% extends "base-show.njk" %}' +
      '{% block main %}{% set var = "child" %}{{ super() }}{% endblock %}',
      '');

    
  });

  test('should let child templates access parent global scope', async function() {
    await equal(
      '{% extends "base-set.njk" %}' +
      '{% block main %}{{ var }}{% endblock %}',
      'parent');

    
  });

  test('should not let super() modify calling scope', async function() {
    await equal(
      '{% extends "base-set-inside-block.njk" %}' +
      '{% block main %}{{ super() }}{{ var }}{% endblock %}',
      '');

    
  });

  test('should not let child templates set vars in parent scope', async function() {
    await equal(
      '{% extends "base-set-and-show.njk" %}' +
      '{% block main %}{% set var = "child" %}{% endblock %}',
      'parent');

    
  });

  test('should render blocks in their own scope', async function() {
    await equal(
      '{% set var = "parent" %}' +
      '{% block main %}{% set var = "inner" %}{% endblock %}' +
      '{{ var }}',
      'parent');

    
  });

  test('should include templates', async function() {
    await equal('hello world {% include "include.njk" %}',
      'hello world FooInclude ');
    
  });

  test('should include 130 templates without call stack size exceed', async function() {
    await equal('{% include "includeMany.njk" %}',
      new Array(131).join('FooInclude \n'));
    
  });

  test('should include templates with context', async function() {
    await equal('hello world {% include "include.njk" %}',
      {
        name: 'james'
      },
      'hello world FooInclude james');
    
  });

  test('should include templates that can see including scope, but not write to it', async function() {
    await equal('{% set var = 1 %}{% include "include-set.njk" %}{{ var }}', '12\n1');
    
  });

  test('should include templates dynamically', async function() {
    await equal('hello world {% include tmpl %}',
      {
        name: 'thedude',
        tmpl: 'include.njk'
      },
      'hello world FooInclude thedude');
    
  });

  test('should include templates dynamically based on a set var', async function() {
    await equal('hello world {% set tmpl = "include.njk" %}{% include tmpl %}',
      {
        name: 'thedude'
      },
      'hello world FooInclude thedude');
    
  });

  test('should include templates dynamically based on an object attr', async function() {
    await equal('hello world {% include data.tmpl %}',
      {
        name: 'thedude',
        data: {
          tmpl: 'include.njk'
        }
      },
      'hello world FooInclude thedude');

    
  });

  test('should throw an error when including a file that does not exist', async function() {
    render(
      '{% include "missing.njk" %}',
      {},
      {
        noThrow: true
      },
      function(err, res) {
        expect(res).toBe(undefined);
        expect(err.message).toMatch(/template not found: missing.njk/);
      }
    );

    
  });

  test('should fail silently on missing templates if requested', async function() {
    await equal('hello world {% include "missing.njk" ignore missing %}',
      'hello world ');

    await equal('hello world {% include "missing.njk" ignore missing %}',
      {
        name: 'thedude'
      },
      'hello world ');

    
  });

  test('should have access to "loop" inside an include', async function() {
    await equal('{% for item in [1,2,3] %}{% include "include-in-loop.njk" %}{% endfor %}',
      '1,0,true\n2,1,false\n3,2,false\n');

    await equal('{% for k,v in items %}{% include "include-in-loop.njk" %}{% endfor %}',
      {
        items: {
          a: 'A',
          b: 'B'
        }
      },
      '1,0,true\n2,1,false\n');

    
  });

  test('should maintain nested scopes', async function() {
    await equal(
      '{% for i in [1,2] %}' +
      '{% for i in [3,4] %}{{ i }}{% endfor %}' +
      '{{ i }}{% endfor %}',
      '341342');

    
  });

  test('should allow blocks in for loops', async function() {
    await equal(
      '{% extends "base2.njk" %}' +
      '{% block item %}hello{{ item }}{% endblock %}',
      'hello1hello2');

    
  });

  test('should make includes inherit scope', async function() {
    await equal(
      '{% for item in [1,2] %}' +
      '{% include "item.njk" %}' +
      '{% endfor %}',
      'showing 1showing 2');

    
  });

  test('should compile a set block', async function() {
    await equal('{% set username = "foo" %}{{ username }}',
      {
        username: 'james'
      },
      'foo');

    await equal('{% set x, y = "foo" %}{{ x }}{{ y }}',
      'foofoo');

    await equal('{% set x = 1 + 2 %}{{ x }}',
      '3');

    await equal('{% for i in [1] %}{% set foo=1 %}{% endfor %}{{ foo }}',
      {
        foo: 2
      },
      '2');

    await equal('{% include "set.njk" %}{{ foo }}',
      {
        foo: 'bar'
      },
      'bar');

    await equal('{% set username = username + "pasta" %}{{ username }}',
      {
        username: 'basta'
      },
      'bastapasta');

    await equal(
      '{% for i in [1] %}{% set val=5 %}{% endfor %}' +
      '{{ val }}',
      '');

    await equal(
      '{% for i in [1,2,3] %}' +
      '{% if not val %}{% set val=5 %}{% endif %}' +
      '{% set val=val+1 %}{{ val }}' +
      '{% endfor %}' +
      'afterwards: {{ val }}',
      '678afterwards: ');

    await equal(
      '{% set val=1 %}' +
      '{% for i in [1] %}{% set val=5 %}{% endfor %}' +
      '{{ val }}',
      '5');

    await equal(
      '{% set val=5 %}' +
      '{% for i in [1,2,3] %}' +
      '{% set val=val+1 %}{{ val }}' +
      '{% endfor %}' +
      'afterwards: {{ val }}',
      '678afterwards: 8');

    
  });

  test('should compile set with frame references', async function() {
    await equal('{% set username = user.name %}{{ username }}',
      {
        user: {
          name: 'james'
        }
      },
      'james');

    
  });

  test('should compile set assignments of the same variable', async function() {
    await equal(
      '{% set x = "hello" %}' +
      '{% if false %}{% set x = "world" %}{% endif %}' +
      '{{ x }}',
      'hello');

    await equal(
      '{% set x = "blue" %}' +
      '{% if true %}{% set x = "green" %}{% endif %}' +
      '{{ x }}',
      'green');

    
  });

  test('should compile block-set', async function() {
    await equal(
      '{% set block_content %}{% endset %}' +
      '{{ block_content }}',
      ''
    );

    await equal(
      '{%- macro foo(bar) -%}' +
      '{%- set test -%}foo{%- endset -%}' +
      '{{ bar }}{{ test }}' +
      '{%- endmacro -%}' +
      '{{ foo("bar") }}',
      'barfoo'
    );

    await equal(
      '{% set block_content %}test string{% endset %}' +
      '{{ block_content }}',
      'test string'
    );

    await equal(
      '{% set block_content %}' +
      '{% for item in [1, 2, 3] %}' +
      '{% include "item.njk" %} ' +
      '{% endfor %}' +
      '{% endset %}' +
      '{{ block_content }}',
      'showing 1 showing 2 showing 3 '
    );

    await equal(
      '{% set block_content %}' +
      '{% set inner_block_content %}' +
      '{% for i in [1, 2, 3] %}' +
      'item {{ i }} ' +
      '{% endfor %}' +
      '{% endset %}' +
      '{% for i in [1, 2, 3] %}' +
      'inner {{i}}: "{{ inner_block_content }}" ' +
      '{% endfor %}' +
      '{% endset %}' +
      '{{ block_content |> safe }}',
      'inner 1: "item 1 item 2 item 3 " ' +
      'inner 2: "item 1 item 2 item 3 " ' +
      'inner 3: "item 1 item 2 item 3 " '
    );

    await equal(
      '{% set x,y,z %}' +
      'cool' +
      '{% endset %}' +
      '{{ x }} {{ y }} {{ z }}',
      'cool cool cool'
    );

    
  });

  test('should compile block-set wrapping an inherited block', async function() {
    await equal(
      '{% extends "base-set-wraps-block.njk" %}' +
      '{% block somevar %}foo{% endblock %}',
      'foo\n'
    );
    
  });

  test('should throw errors', async function() {
    render('{% from "import.njk" import boozle %}',
      {},
      {
        noThrow: true
      },
      function(err) {
        expect(err.message).toMatch(/cannot import 'boozle'/);
      });

    
  });

  test('should allow custom tag compilation', async function() {
    function TestExtension() {
      this.tags = ['test'];

      this.parse = function(parser, nodes) {
        var content;
        var tag;
        parser.advanceAfterBlockEnd();

        content = parser.parseUntilBlocks('endtest');
        tag = new nodes.CallExtension(this, 'run', null, [content]);
        parser.advanceAfterBlockEnd();

        return tag;
      };

      this.run = async function(context, contentFn) {
        const content = await contentFn();
        return content.split('').reverse().join('');
      };
    }

    await equal('{% test %}123456789{% endtest %}', null,
      { extensions: { TestExtension: new TestExtension() } },
      '987654321');

    
  });

  test('should allow custom tag compilation without content', async function() {
    function TestExtension() {
      this.tags = ['test'];

      this.parse = function(parser, nodes) {
        var tok = parser.nextToken();
        var args = parser.parseSignature(null, true);
        parser.advanceAfterBlockEnd(tok.value);

        return new nodes.CallExtension(this, 'run', args, null);
      };

      this.run = function(context, arg1) {
        return arg1.split('').reverse().join('');
      };
    }

    await equal('{% test "123456" %}', null,
      { extensions: { TestExtension: new TestExtension() } },
      '654321');

    
  });

  test('should allow complicated custom tag compilation', async function() {
    function TestExtension() {
      this.tags = ['test'];

      this._name = TestExtension;

      this.parse = function(parser, nodes, lexer) {
        var body;
        var intermediate = null;

        parser.advanceAfterBlockEnd();

        body = parser.parseUntilBlocks('intermediate', 'endtest');

        if (parser.skipSymbol('intermediate')) {
          parser.skip(lexer.TOKEN_BLOCK_END);
          intermediate = parser.parseUntilBlocks('endtest');
        }

        parser.advanceAfterBlockEnd();

        return new nodes.CallExtension(this, 'run', null, [body, intermediate]);
      };

      this.run = async function(context, body, intermediate) {
        var output = (await body()).split('').join(',');
        if (intermediate) {
          output += (await intermediate()).split('').reverse().join('');
        }
        return output;
      };
    }

    await equal('{% test %}abcdefg{% endtest %}', null,
      { extensions: { TestExtension: new TestExtension() } },
      'a,b,c,d,e,f,g');

    await equal('{% test %}abcdefg{% intermediate %}second half{% endtest %}',
      null,
      { extensions: { TestExtension: new TestExtension() } },
      'a,b,c,d,e,f,gflah dnoces');

    
  });

  test('should allow custom tag with args compilation', async function() {
    var opts;

    function TestExtension() {
      this.tags = ['test'];

      this._name = TestExtension;

      this.parse = function(parser, nodes) {
        var body;
        var args;
        var tok = parser.nextToken();

        args = parser.parseSignature(true);
        parser.advanceAfterBlockEnd(tok.value);

        body = parser.parseUntilBlocks('endtest');
        parser.advanceAfterBlockEnd();

        return new nodes.CallExtension(this, 'run', args, [body]);
      };

      this.run = async function(context, prefix, kwargs, body) {
        var output;
        if (typeof prefix === 'function') {
          body = prefix;
          prefix = '';
          kwargs = {};
        } else if (typeof kwargs === 'function') {
          body = kwargs;
          kwargs = {};
        }

        output = prefix + (await body()).split('').reverse().join('');
        if (kwargs.cutoff) {
          output = output.slice(0, kwargs.cutoff);
        }

        return output;
      };
    }

    opts = {
      extensions: {
        TestExtension: new TestExtension()
      }
    };

    await equal(
      '{% test %}foobar{% endtest %}', null, opts,
      'raboof');

    await equal(
      '{% test("biz") %}foobar{% endtest %}', null, opts,
      'bizraboof');

    await equal(
      '{% test("biz", cutoff=5) %}foobar{% endtest %}', null, opts,
      'bizra');

    
  });

  test('should autoescape by default', async function() {
    await equal('{{ foo }}', {
      foo: '"\'<>&'
    }, '&quot;&#39;&lt;&gt;&amp;');
    
  });

  test('should autoescape if autoescape is on', async function() {
    await equal(
      '{{ foo }}',
      { foo: '"\'<>&' },
      { autoescape: true },
      '&quot;&#39;&lt;&gt;&amp;');

    await equal('{{ foo|>reverse }}',
      { foo: '"\'<>&' },
      { autoescape: true },
      '&amp;&gt;&lt;&#39;&quot;');

    await equal(
      '{{ foo|>reverse|>safe }}',
      { foo: '"\'<>&' },
      { autoescape: true },
      '&><\'"');

    await equal(
      '{{ foo }}',
      { foo: null },
      { autoescape: true },
      '');

    await equal(
      '{{ foo }}',
      { foo: ['<p>foo</p>'] },
      { autoescape: true },
      '&lt;p&gt;foo&lt;/p&gt;');

    await equal(
      '{{ foo }}',
      { foo: { toString: function() { return '<p>foo</p>'; } } },
      { autoescape: true },
      '&lt;p&gt;foo&lt;/p&gt;');

    await equal('{{ foo |> safe }}',
      { foo: null },
      { autoescape: true },
      '');

    await equal(
      '{{ foo |> safe }}',
      { foo: '<p>foo</p>' },
      { autoescape: true },
      '<p>foo</p>');

    await equal(
      '{{ foo |> safe }}',
      { foo: ['<p>foo</p>'] },
      { autoescape: true },
      '<p>foo</p>');

    await equal(
      '{{ foo |> safe }}',
      { foo: { toString: function() { return '<p>foo</p>'; } } },
      { autoescape: true },
      '<p>foo</p>');

    
  });

  test('should not autoescape safe strings', async function() {
    await equal(
      '{{ foo|>safe }}',
      { foo: '"\'<>&' },
      { autoescape: true },
      '"\'<>&');

    
  });

  test('should not autoescape macros', async function() {
    render(
      '{% macro foo(x, y) %}{{ x }} and {{ y }}{% endmacro %}' +
      '{{ foo("<>&", "<>") }}',
      null,
      {
        autoescape: true
      },
      function(err, res) {
        expect(res).toBe('&lt;&gt;&amp; and &lt;&gt;');
      }
    );

    render(
      '{% macro foo(x, y) %}{{ x|>safe }} and {{ y }}{% endmacro %}' +
      '{{ foo("<>&", "<>") }}',
      null,
      {
        autoescape: true
      },
      function(err, res) {
        expect(res).toBe('<>& and &lt;&gt;');
      }
    );

    
  });

  test('should not autoescape super()', async function() {
    render(
      '{% extends "base3.njk" %}' +
      '{% block block1 %}{{ super() }}{% endblock %}',
      null,
      {
        autoescape: true
      },
      function(err, res) {
        expect(res).toBe('<b>Foo</b>');
      }
    );

    
  });

  test('should autoescape backslashes', async function() {
    await equal(
      '{{ foo }}',
      { foo: 'foo \\\' bar' },
      { autoescape: true },
      'foo &#92;&#39; bar');

    
  });

  test('should not autoescape when extension set false', async function() {
    function TestExtension() {
      this.tags = ['test'];

      this.autoescape = false;

      this.parse = function(parser, nodes) {
        var tok = parser.nextToken();
        var args = parser.parseSignature(null, true);
        parser.advanceAfterBlockEnd(tok.value);
        return new nodes.CallExtension(this, 'run', args, null);
      };

      this.run = function() {
        return '<b>Foo</b>';
      };
    }

    render(
      '{% test "123456" %}',
      null,
      {
        extensions: { TestExtension: new TestExtension() },
        autoescape: true
      },
      function(err, res) {
        expect(res).toBe('<b>Foo</b>');
      }
    );

    
  });

  test('should pass context as this to pipes', async function() {
    render(
      '{{ foo |> hallo }}',
      { foo: 1, bar: 2 },
      {
        filters: {
          hallo: function(foo) {
            return foo + this.lookup('bar');
          }
        }
      },
      function(err, res) {
        expect(res).toBe('3');
      }
    );

    
  });

  test('should render regexs', async function() {
    await equal('{{ r/name [0-9] \\// }}', {}, { autoescape: false },
      '/name [0-9] \\//');

    await equal('{{ r/x/gi }}',
      '/x/gi');

    
  });

  test('should throw an error when {% call %} is passed an object that is not a function', async function() {
    render(
      '{% call foo() %}{% endcall %}',
      {foo: 'bar'},
      {noThrow: true},
      function(err, res) {
        expect(res).toBe(undefined);
        expect(err.message).toMatch(/Unable to call `\w+`, which is not a function/);
      });

    
  });

  test('should throw an error when including a file that calls an undefined macro', async function() {
    render(
      '{% include "undefined-macro.njk" %}',
      {},
      {
        noThrow: true
      },
      function(err, res) {
        expect(res).toBe(undefined);
        expect(err.message).toMatch(/Unable to call `\w+`, which is undefined or falsey/);
      }
    );

    
  });

  test('should throw an error when including a file that calls an undefined macro even inside {% if %} tag', async function() {
    render(
      '{% if true %}{% include "undefined-macro.njk" %}{% endif %}',
      {},
      {
        noThrow: true
      },
      function(err, res) {
        expect(res).toBe(undefined);
        expect(err.message).toMatch(/Unable to call `\w+`, which is undefined or falsey/);
      }
    );

    
  });

  test('should throw an error when including a file that imports macro that calls an undefined macro', async function() {
    render(
      '{% include "import-macro-call-undefined-macro.njk" %}',
      { list: [1, 2, 3] },
      { noThrow: true },
      function(err, res) {
        expect(res).toBe(undefined);
        expect(err.message).toMatch(/Unable to call `\w+`, which is undefined or falsey/);
      }
    );

    
  });


  test('should control whitespaces correctly', async function() {
    await equal(
      '{% if true -%}{{"hello"}} {{"world"}}{% endif %}',
      'hello world');

    await equal(
      '{% if true -%}{% if true %} {{"hello"}} {{"world"}}'
      + '{% endif %}{% endif %}',
      ' hello world');

    await equal(
      '{% if true -%}{# comment #} {{"hello"}}{% endif %}',
      ' hello');

    
  });

  test('should control expression whitespaces correctly', async function() {
    await equal(
      'Well, {{- \' hello, \' -}} my friend',
      'Well, hello, my friend'
    );

    await equal(' {{ 2 + 2 }} ', ' 4 ');

    await equal(' {{-2 + 2 }} ', '4 ');

    await equal(' {{ -2 + 2 }} ', ' 0 ');

    await equal(' {{ 2 + 2 -}} ', ' 4');

    
  });

  test('should get right value when macro parameter conflict with global macro name', async function() {
    render(
      '{# macro1 and macro2 definition #}' +
      '{% macro macro1() %}' +
      '{% endmacro %}' +
      '' +
      '{% macro macro2(macro1="default") %}' +
      '{{macro1}}' +
      '{% endmacro %}' +
      '' +
      '{# calling macro2 #}' +
      '{{macro2("this should be outputted") }}', {}, {}, function(err, res) {
          expect(res.trim()).toEqual('this should be outputted');
        });

    
  });

  test('should get right value when macro include macro', async function() {
    render(
      '{# macro1 and macro2 definition #}' +
      '{% macro macro1() %} foo' +
      '{% endmacro %}' +
      '' +
      '{% macro macro2(text="default") %}' +
      '{{macro1()}}' +
      '{% endmacro %}' +
      '' +
      '{# calling macro2 #}' +
      '{{macro2("this should not be outputted") }}', {}, {}, function(err, res) {
          expect(res.trim()).toEqual('foo');
        });

    
  });

  test('should allow access to outer scope in call blocks', async function() {
    render(
      '{% macro inside() %}' +
      '{{ caller() }}' +
      '{% endmacro %}' +
      '{% macro outside(var) %}' +
      '{{ var }}\n' +
      '{% call inside() %}' +
      '{{ var }}' +
      '{% endcall %}' +
      '{% endmacro %}' +
      '{{ outside("foobar") }}', {}, {}, function(err, res) {
          expect(res.trim()).toEqual('foobar\nfoobar');
        });

    
  });

  test('should not leak scope from call blocks to parent', async function() {
    render(
      '{% set var = "expected" %}' +
      '{% macro inside() %}' +
      '{% set var = "incorrect-value" %}' +
      '{{ caller() }}' +
      '{% endmacro %}' +
      '{% macro outside() %}' +
      '{% call inside() %}' +
      '{% endcall %}' +
      '{% endmacro %}' +
      '{{ outside() }}' +
      '{{ var }}', {}, {}, function(err, res) {
          expect(res.trim()).toEqual('expected');
        });

    
  });


  if (!isSlim) {
    test('should import template objects', async function() {
      var tmpl = new Template('{% macro foo() %}Inside a macro{% endmacro %}' +
        '{% set bar = "BAZ" %}');

      await equal(
        '{% import tmpl as imp %}' +
        '{{ imp.foo() }} {{ imp.bar }}',
        {
          tmpl: tmpl
        },
        'Inside a macro BAZ');

      await equal(
        '{% from tmpl import foo as baz, bar %}' +
        '{{ bar }} {{ baz() }}',
        {
          tmpl: tmpl
        },
        'BAZ Inside a macro');

      
    });

    test('should inherit template objects', async function() {
      var tmpl = new Template('Foo{% block block1 %}Bar{% endblock %}' +
        '{% block block2 %}Baz{% endblock %}Whizzle');

      await equal('hola {% extends tmpl %} fizzle mumble',
        {
          tmpl: tmpl
        },
        'FooBarBazWhizzle');

      await equal(
        '{% extends tmpl %}' +
        '{% block block1 %}BAR{% endblock %}' +
        '{% block block2 %}BAZ{% endblock %}',
        {
          tmpl: tmpl
        },
        'FooBARBAZWhizzle');

      
    });

    test('should include template objects', async function() {
      var tmpl = new Template('FooInclude {{ name }}');

      await equal('hello world {% include tmpl %}',
        {
          name: 'thedude',
          tmpl: tmpl
        },
        'hello world FooInclude thedude');

      
    });

    test('should throw an error when invalid expression whitespaces are used', async function() {
      render(
        ' {{ 2 + 2- }}',
        {},
        {
          noThrow: true
        },
        function(err, res) {
          expect(res).toBe(undefined);
          expect(err.message).toMatch(/unexpected token: }}/);
        }
      );

      
    });
  }
});

describe('the filter tag', function() {
  test('should apply the title filter to the body', async function() {
    await equal('{% filter title %}may the force be with you{% endfilter %}',
      'May The Force Be With You');
    
  });

  test('should apply the replace filter to the body', async function() {
    await equal('{% filter replace("force", "forth") %}may the force be with you{% endfilter %}',
      'may the forth be with you');
    
  });

  test('should work with variables in the body', async function() {
    await equal('{% set foo = "force" %}{% filter replace("force", "forth") %}may the {{ foo }} be with you{% endfilter %}',
      'may the forth be with you');
    
  });

  test('should work with blocks in the body', async function() {
    await equal(
      '{% extends "filter-block.html" %}' +
      '{% block block1 %}force{% endblock %}',
      'may the forth be with you\n');
    
  });
});
