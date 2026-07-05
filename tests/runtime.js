import expect from 'expect.js';
import * as util from './util.js';

var render = util.render;

describe('runtime', function() {
  it('should report the failed function calls to symbols', async function() {
    render('{{ foo("cvan") }}', {}, {
      noThrow: true
    }, function(err) {
      expect(err).to.match(/Unable to call `foo`, which is undefined/);
    });
  });

  it('should report the failed function calls to lookups', async function() {
    render('{{ foo["bar"]("cvan") }}', {}, {
      noThrow: true
    }, function(err) {
      expect(err).to.match(/foo\["bar"\]/);
    });
  });

  it('should report the failed function calls to calls', async function() {
    render('{{ foo.bar("second call") }}', {}, {
      noThrow: true
    }, function(err) {
      expect(err).to.match(/foo\["bar"\]/);
    });
  });

  it('should report full function name in error', async function() {
    render('{{ foo.barThatIsLongerThanTen() }}', {}, {
      noThrow: true
    }, function(err) {
      expect(err).to.match(/foo\["barThatIsLongerThanTen"\]/);
    });
  });

  it('should report the failed function calls w/multiple args', async function() {
    render('{{ foo.bar("multiple", "args") }}', {}, {
      noThrow: true
    }, function(err) {
      expect(err).to.match(/foo\["bar"\]/);
    });

    render('{{ foo["bar"]["zip"]("multiple", "args") }}',
      {},
      {
        noThrow: true
      },
      function(err) {
        expect(err).to.match(/foo\["bar"\]\["zip"\]/);
      });
  });

  it('should allow for undefined macro arguments in the last position', async function() {
    render('{% macro foo(bar, baz) %}' +
      '{{ bar }} {{ baz }}{% endmacro %}' +
      '{{ foo("hello", nosuchvar) }}',
    {},
    {
      noThrow: true
    },
    function(err, res) {
      expect(err).to.equal(null);
      expect(typeof res).to.be('string');
    });
  });

  it('should allow for objects without a prototype macro arguments in the last position', async function() {
    var noProto = Object.create(null);
    noProto.qux = 'world';

    render('{% macro foo(bar, baz) %}' +
    '{{ bar }} {{ baz.qux }}{% endmacro %}' +
    '{{ foo("hello", noProto) }}',
    {
      noProto: noProto
    },
    {
      noThrow: true
    },
    function(err, res) {
      expect(err).to.equal(null);
      expect(res).to.equal('hello world');
    });
  });

  it('should not read variables property from Object.prototype', async function() {
    var payload = 'function(){ return 1+2; }()';
    var data = {};
    Object.getPrototypeOf(data).payload = payload;

    render('{{ payload }}', data, {
      noThrow: true
    }, function(err, res) {
      expect(err).to.equal(null);
      expect(res).to.equal(payload);
    });
    delete Object.getPrototypeOf(data).payload;
  });
});
