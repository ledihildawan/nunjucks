import { expect, describe, test } from 'bun:test';
import * as util from '../../util.js';

var render = util.render;
var equal = util.equal;

describe('tests', function() {
  test('callable should detect callability', async function() {
    var callable = await render('{{ foo is callable }}', {
      foo: function() {
        return '!!!';
      }
    });
    var uncallable = await render('{{ foo is not callable }}', {
      foo: '!!!'
    });
    expect(callable).toBe('true');
    expect(uncallable).toBe('true');
  });

  test('defined should detect definedness', async function() {
    expect(await render('{{ foo is defined }}')).toBe('false');
    expect(await render('{{ foo is not defined }}')).toBe('true');
    expect(await render('{{ foo is defined }}', {
      foo: null
    })).toBe('true');
    expect(await render('{{ foo is not defined }}', {
      foo: null
    })).toBe('false');
  });

  test('should support "is defined" in {% if %} expressions', async function() {
    expect(
      await render('{% if foo is defined %}defined{% else %}undefined{% endif %}',
        {})
    ).toBe('undefined');
    expect(
      await render('{% if foo is defined %}defined{% else %}undefined{% endif %}',
        {foo: null})
    ).toBe('defined');
  });

  test('should support "is not defined" in {% if %} expressions', async function() {
    expect(
      await render('{% if foo is not defined %}undefined{% else %}defined{% endif %}',
        {})
    ).toBe('undefined');
    expect(
      await render('{% if foo is not defined %}undefined{% else %}defined{% endif %}',
        {foo: null})
    ).toBe('defined');
  });

  test('undefined should detect undefinedness', async function() {
    expect(await render('{{ foo is undefined }}')).toBe('true');
    expect(await render('{{ foo is not undefined }}')).toBe('false');
    expect(await render('{{ foo is undefined }}', {
      foo: null
    })).toBe('false');
    expect(await render('{{ foo is not undefined }}', {
      foo: null
    })).toBe('true');
  });

  test('none/null should detect strictly null values', async function() {
    expect(await render('{{ null is null }}')).toBe('true');
    expect(await render('{{ none is none }}')).toBe('true');
    expect(await render('{{ none is null }}')).toBe('true');
    expect(await render('{{ foo is null }}')).toBe('false');
    expect(await render('{{ foo is not null }}', {
      foo: null
    })).toBe('false');
  });

  test('divisibleby should detect divisibility', async function() {
    var divisible = await render('{{ "6" is divisibleby(3) }}');
    var notDivisible = await render('{{ 3 is not divisibleby(2) }}');
    expect(divisible).toBe('true');
    expect(notDivisible).toBe('true');
  });

  test('escaped should test whether or not something is escaped', async function() {
    var escaped = await render('{{ (foo |> safe) is escaped }}', {
      foo: 'foobarbaz'
    });
    var notEscaped = await render('{{ foo is escaped }}', {
      foo: 'foobarbaz'
    });
    expect(escaped).toBe('true');
    expect(notEscaped).toBe('false');
  });

  test('even should detect whether or not a number is even', async function() {
    var fiveEven = await render('{{ "5" is even }}');
    var fourNotEven = await render('{{ 4 is not even }}');
    expect(fiveEven).toBe('false');
    expect(fourNotEven).toBe('false');
  });

  test('odd should detect whether or not a number is odd', async function() {
    var fiveOdd = await render('{{ "5" is odd }}');
    var fourNotOdd = await render('{{ 4 is not odd }}');
    expect(fiveOdd).toBe('true');
    expect(fourNotOdd).toBe('true');
  });

  test('mapping should detect Maps or hashes', async function() {
    var map1 = new Map();
    var map2 = {};
    var mapOneIsMapping = await render('{{ map is mapping }}', {
      map: map1
    });
    var mapTwoIsMapping = await render('{{ map is mapping }}', {
      map: map2
    });
    expect(mapOneIsMapping).toBe('true');
    expect(mapTwoIsMapping).toBe('true');
  });

  test('falsy should detect whether or not a value is falsy', async function() {
    var zero = await render('{{ 0 is falsy }}');
    var pancakes = await render('{{ "pancakes" is not falsy }}');
    expect(zero).toBe('true');
    expect(pancakes).toBe('true');
  });

  test('truthy should detect whether or not a value is truthy', async function() {
    var nullTruthy = await render('{{ null is truthy }}');
    var pancakesNotTruthy = await render('{{ "pancakes" is not truthy }}');
    expect(nullTruthy).toBe('false');
    expect(pancakesNotTruthy).toBe('false');
  });

  test('greaterthan than should detect whether or not a value is less than another', async function() {
    var fiveGreaterThanFour = await render('{{ "5" is greaterthan(4) }}');
    var fourNotGreaterThanTwo = await render('{{ 4 is not greaterthan(2) }}');
    expect(fiveGreaterThanFour).toBe('true');
    expect(fourNotGreaterThanTwo).toBe('false');
  });

  test('ge should detect whether or not a value is greater than or equal to another', async function() {
    var fiveGreaterThanEqualToFive = await render('{{ "5" is ge(5) }}');
    var fourNotGreaterThanEqualToTwo = await render('{{ 4 is not ge(2) }}');
    expect(fiveGreaterThanEqualToFive).toBe('true');
    expect(fourNotGreaterThanEqualToTwo).toBe('false');
  });

  test('lessthan than should detect whether or not a value is less than another', async function() {
    var fiveLessThanFour = await render('{{ "5" is lessthan(4) }}');
    var fourNotLessThanTwo = await render('{{ 4 is not lessthan(2) }}');
    expect(fiveLessThanFour).toBe('false');
    expect(fourNotLessThanTwo).toBe('true');
  });

  test('le should detect whether or not a value is less than or equal to another', async function() {
    var fiveLessThanEqualToFive = await render('{{ "5" is le(5) }}');
    var fourNotLessThanEqualToTwo = await render('{{ 4 is not le(2) }}');
    expect(fiveLessThanEqualToFive).toBe('true');
    expect(fourNotLessThanEqualToTwo).toBe('true');
  });

  test('ne should detect whether or not a value is not equal to another', async function() {
    var five = await render('{{ 5 is ne(5) }}');
    var four = await render('{{ 4 is not ne(2) }}');
    expect(five).toBe('false');
    expect(four).toBe('false');
  });

  test('iterable should detect that a generator is iterable', async function() {
    var iterable = (function* iterable() { yield true; })();
    equal('{{ fn is iterable }}', { fn: iterable }, 'true');
  });

  test('iterable should detect that an Array is not non-iterable', async function() {
    equal('{{ arr is not iterable }}', { arr: [] }, 'false');
  });

  test('iterable should detect that a Map is iterable', async function() {
    equal('{{ map is iterable }}', { map: new Map() }, 'true');
  });

  test('iterable should detect that a Set is not non-iterable', async function() {
    equal('{{ set is not iterable }}', { set: new Set() }, 'false');
  });

  test('number should detect whether a value is numeric', async function() {
    var num = await render('{{ 5 is number }}');
    var str = await render('{{ "42" is number }}');
    expect(num).toBe('true');
    expect(str).toBe('false');
  });

  test('string should detect whether a value is a string', async function() {
    var num = await render('{{ 5 is string }}');
    var str = await render('{{ "42" is string }}');
    expect(num).toBe('false');
    expect(str).toBe('true');
  });

  test('equalto should detect value equality', async function() {
    var same = await render('{{ 1 is equalto(2) }}');
    var notSame = await render('{{ 2 is not equalto(2) }}');
    expect(same).toBe('false');
    expect(notSame).toBe('false');
  });

  test('sameas should alias to equalto', async function() {
    var obj = {};
    var same = await render('{{ obj1 is sameas(obj2) }}', {
      obj1: obj,
      obj2: obj
    });
    expect(same).toBe('true');
  });

  test('lower should detect whether or not a string is lowercased', async function() {
    expect(await render('{{ "foobar" is lower }}')).toBe('true');
    expect(await render('{{ "Foobar" is lower }}')).toBe('false');
  });

  test('upper should detect whether or not a string is uppercased', async function() {
    expect(await render('{{ "FOOBAR" is upper }}')).toBe('true');
    expect(await render('{{ "Foobar" is upper }}')).toBe('false');
  });
});
