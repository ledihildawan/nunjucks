import { expect, describe, test } from 'bun:test';
import { precompile, precompileString } from '../../../nunjucks/src/precompile/index.js';

describe('precompile', function() {
  test('should return a string', function() {
    expect(precompileString('{{ test }}', {
      name: 'test.njk'
    })).toBeTypeOf('string');
  });

  describe('templates', function() {
    test('should return *NIX path seperators', function() {
      var fileName;

      precompile('./tests/templates/item.njk', {
        wrapper: function(templates) {
          fileName = templates[0].name;
        }
      });

      expect(fileName).toBe('./tests/templates/item.njk');
    });

    test('should return *NIX path seperators, when name is passed as option', function() {
      var fileName;

      precompile('<span>test</span>', {
        name: 'path\\to\\file.j2',
        isString: true,
        wrapper: function(templates) {
          fileName = templates[0].name;
        }
      });

      expect(fileName).toBe('path/to/file.j2');
    });
  });
});
