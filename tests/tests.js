import expect from 'expect.js';
import * as util from './util.js';

var render = util.render;
var equal = util.equal;

describe('tests', function() {
  it('callable should detect callability', async function() {
    var callable = await render('{{ foo is callable }}', {
      foo: function() {
        return '!!!';
      }
    });
    var uncallable = await render('{{ foo is not callable }}', {
      foo: '!!!'
    });
    expect(callable).to.be('true');
    expect(uncallable).to.be('true');
  });

  it('defined should detect definedness', async function() {
    expect(await render('{{ foo is defined }}')).to.be('false');
    expect(await render('{{ foo is not defined }}')).to.be('true');
    expect(await render('{{ foo is defined }}', {
      foo: null
    })).to.be('true');
    expect(await render('{{ foo is not defined }}', {
      foo: null
    })).to.be('false');
  });

  it('should support "is defined" in {% if %} expressions', async function() {
    expect(
      await render('{% if foo is defined %}defined{% else %}undefined{% endif %}',
        {})
    ).to.be('undefined');
    expect(
      await render('{% if foo is defined %}defined{% else %}undefined{% endif %}',
        {foo: null})
    ).to.be('defined');
  });

  it('should support "is not defined" in {% if %} expressions', async function() {
    expect(
      await render('{% if foo is not defined %}undefined{% else %}defined{% endif %}',
        {})
    ).to.be('undefined');
    expect(
      await render('{% if foo is not defined %}undefined{% else %}defined{% endif %}',
        {foo: null})
    ).to.be('defined');
  });

  it('undefined should detect undefinedness', async function() {
    expect(await render('{{ foo is undefined }}')).to.be('true');
    expect(await render('{{ foo is not undefined }}')).to.be('false');
    expect(await render('{{ foo is undefined }}', {
      foo: null
    })).to.be('false');
    expect(await render('{{ foo is not undefined }}', {
      foo: null
    })).to.be('true');
  });

  it('none/null should detect strictly null values', async function() {
    expect(await render('{{ null is null }}')).to.be('true');
    expect(await render('{{ none is none }}')).to.be('true');
    expect(await render('{{ none is null }}')).to.be('true');
    expect(await render('{{ foo is null }}')).to.be('false');
    expect(await render('{{ foo is not null }}', {
      foo: null
    })).to.be('false');
  });

  it('divisibleby should detect divisibility', async function() {
    var divisible = await render('{{ "6" is divisibleby(3) }}');
    var notDivisible = await render('{{ 3 is not divisibleby(2) }}');
    expect(divisible).to.be('true');
    expect(notDivisible).to.be('true');
  });

  it('escaped should test whether or not something is escaped', async function() {
    var escaped = await render('{{ (foo |> safe) is escaped }}', {
      foo: 'foobarbaz'
    });
    var notEscaped = await render('{{ foo is escaped }}', {
      foo: 'foobarbaz'
    });
    expect(escaped).to.be('true');
    expect(notEscaped).to.be('false');
  });

  it('even should detect whether or not a number is even', async function() {
    var fiveEven = await render('{{ "5" is even }}');
    var fourNotEven = await render('{{ 4 is not even }}');
    expect(fiveEven).to.be('false');
    expect(fourNotEven).to.be('false');
  });

  it('odd should detect whether or not a number is odd', async function() {
    var fiveOdd = await render('{{ "5" is odd }}');
    var fourNotOdd = await render('{{ 4 is not odd }}');
    expect(fiveOdd).to.be('true');
    expect(fourNotOdd).to.be('true');
  });

  it('mapping should detect Maps or hashes', async function() {
    var map1, map2, mapOneIsMapping, mapTwoIsMapping;
    if (typeof Map === 'undefined') {
      this.skip();
    } else {
      map1 = new Map();
      map2 = {};
      mapOneIsMapping = await render('{{ map is mapping }}', {
        map: map1
      });
      mapTwoIsMapping = await render('{{ map is mapping }}', {
        map: map2
      });
      expect(mapOneIsMapping).to.be('true');
      expect(mapTwoIsMapping).to.be('true');
    }
  });

  it('falsy should detect whether or not a value is falsy', async function() {
    var zero = await render('{{ 0 is falsy }}');
    var pancakes = await render('{{ "pancakes" is not falsy }}');
    expect(zero).to.be('true');
    expect(pancakes).to.be('true');
  });

  it('truthy should detect whether or not a value is truthy', async function() {
    var nullTruthy = await render('{{ null is truthy }}');
    var pancakesNotTruthy = await render('{{ "pancakes" is not truthy }}');
    expect(nullTruthy).to.be('false');
    expect(pancakesNotTruthy).to.be('false');
  });

  it('greaterthan than should detect whether or not a value is less than another', async function() {
    var fiveGreaterThanFour = await render('{{ "5" is greaterthan(4) }}');
    var fourNotGreaterThanTwo = await render('{{ 4 is not greaterthan(2) }}');
    expect(fiveGreaterThanFour).to.be('true');
    expect(fourNotGreaterThanTwo).to.be('false');
  });

  it('ge should detect whether or not a value is greater than or equal to another', async function() {
    var fiveGreaterThanEqualToFive = await render('{{ "5" is ge(5) }}');
    var fourNotGreaterThanEqualToTwo = await render('{{ 4 is not ge(2) }}');
    expect(fiveGreaterThanEqualToFive).to.be('true');
    expect(fourNotGreaterThanEqualToTwo).to.be('false');
  });

  it('lessthan than should detect whether or not a value is less than another', async function() {
    var fiveLessThanFour = await render('{{ "5" is lessthan(4) }}');
    var fourNotLessThanTwo = await render('{{ 4 is not lessthan(2) }}');
    expect(fiveLessThanFour).to.be('false');
    expect(fourNotLessThanTwo).to.be('true');
  });

  it('le should detect whether or not a value is less than or equal to another', async function() {
    var fiveLessThanEqualToFive = await render('{{ "5" is le(5) }}');
    var fourNotLessThanEqualToTwo = await render('{{ 4 is not le(2) }}');
    expect(fiveLessThanEqualToFive).to.be('true');
    expect(fourNotLessThanEqualToTwo).to.be('true');
  });

  it('ne should detect whether or not a value is not equal to another', async function() {
    var five = await render('{{ 5 is ne(5) }}');
    var four = await render('{{ 4 is not ne(2) }}');
    expect(five).to.be('false');
    expect(four).to.be('false');
  });

  it('iterable should detect that a generator is iterable', function(done) {
    var iterable;
    try {
      iterable = (function* iterable() { yield true; })();
    } catch (e) {
      return this.skip();
    }
    equal('{{ fn is iterable }}', { fn: iterable }, 'true');
    return done();
  });

  it('iterable should detect that an Array is not non-iterable', async function() {
    equal('{{ arr is not iterable }}', { arr: [] }, 'false');
  });

  it('iterable should detect that a Map is iterable', async function() {
    if (typeof Map === 'undefined') {
      this.skip();
    } else {
      equal('{{ map is iterable }}', { map: new Map() }, 'true');
    }
  });

  it('iterable should detect that a Set is not non-iterable', async function() {
    if (typeof Set === 'undefined') {
      this.skip();
    } else {
      equal('{{ set is not iterable }}', { set: new Set() }, 'false');
    }
  });

  it('number should detect whether a value is numeric', async function() {
    var num = await render('{{ 5 is number }}');
    var str = await render('{{ "42" is number }}');
    expect(num).to.be('true');
    expect(str).to.be('false');
  });

  it('string should detect whether a value is a string', async function() {
    var num = await render('{{ 5 is string }}');
    var str = await render('{{ "42" is string }}');
    expect(num).to.be('false');
    expect(str).to.be('true');
  });

  it('equalto should detect value equality', async function() {
    var same = await render('{{ 1 is equalto(2) }}');
    var notSame = await render('{{ 2 is not equalto(2) }}');
    expect(same).to.be('false');
    expect(notSame).to.be('false');
  });

  it('sameas should alias to equalto', async function() {
    var obj = {};
    var same = await render('{{ obj1 is sameas(obj2) }}', {
      obj1: obj,
      obj2: obj
    });
    expect(same).to.be('true');
  });

  it('lower should detect whether or not a string is lowercased', async function() {
    expect(await render('{{ "foobar" is lower }}')).to.be('true');
    expect(await render('{{ "Foobar" is lower }}')).to.be('false');
  });

  it('upper should detect whether or not a string is uppercased', async function() {
    expect(await render('{{ "FOOBAR" is upper }}')).to.be('true');
    expect(await render('{{ "Foobar" is upper }}')).to.be('false');
  });
});
