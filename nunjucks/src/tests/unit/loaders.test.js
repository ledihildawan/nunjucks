import { expect, describe, test, beforeEach } from 'bun:test';
import path from 'path';
import { fileURLToPath } from 'url';
import { Environment } from '../../environment/index.js';
import { WebLoader } from '../../loaders/web.js';
import { FileSystemLoader } from '../../loaders/file-system.js';
import { NodeResolveLoader } from '../../loaders/node-resolve.js';

var templatesPath = 'nunjucks/src/tests/templates';

describe('loader', function() {
  test('should allow a simple loader to be created', async function() {
    var env, parent;

    function MyLoader() {
    }

    MyLoader.prototype.getSource = function() {
      return {
        src: 'Hello World',
        path: '/tmp/somewhere'
      };
    };

    env = new Environment(new MyLoader(templatesPath));
    parent = await env.getTemplate('fake.njk');
    expect(await parent.render()).toBe('Hello World');
  });

  test('should catch loader error', async function() {
    function MyLoader() {
      this.async = true;
    }

    MyLoader.prototype.getSource = async function(s) {
      throw new Error('test');
    };

    var env = new Environment(new MyLoader(templatesPath));
    try {
      await env.getTemplate('fake.njk');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
    }
  });

  describe('WebLoader', function() {
    test('should have default opts for WebLoader', function() {
      var webLoader = new WebLoader(templatesPath);
      expect(webLoader).toBeInstanceOf(WebLoader);
      expect(webLoader.useCache).toBe(false);
      expect(webLoader.async).toBe(true);
    });

    test('should emit a "load" event', async function() {
      if (typeof window === 'undefined') {
        return;
      }
      var loader = new WebLoader(templatesPath);
      var loadedTemplate;
      loader.on('load', function(name, source) {
        loadedTemplate = name;
      });
      await loader.getSource('simple-base.njk');
      expect(loadedTemplate).toEqual('simple-base.njk');
    });
  });

  if (typeof FileSystemLoader !== 'undefined') {
    describe('FileSystemLoader', function() {
      test('should have default opts', function() {
        var loader = new FileSystemLoader(templatesPath);
        expect(loader).toBeInstanceOf(FileSystemLoader);
        expect(loader.noCache).toBe(false);
      });

      test('should emit a "load" event', async function() {
        var loader = new FileSystemLoader(templatesPath);
        var loadedTemplate;
        loader.on('load', function(name, source) {
          loadedTemplate = name;
        });
        await loader.getSource('simple-base.njk');
        expect(loadedTemplate).toEqual('simple-base.njk');
      });
    });
  }

  if (typeof NodeResolveLoader !== 'undefined') {
    describe('NodeResolveLoader', function() {
      test('should have default opts', function() {
        var loader = new NodeResolveLoader();
        expect(loader).toBeInstanceOf(NodeResolveLoader);
        expect(loader.noCache).toBe(false);
      });

      test('should return null if no match', async function() {
        var loader = new NodeResolveLoader();
        var tmplName = 'dummy-pkg/does-not-exist.html';
        expect(await loader.getSource(tmplName)).toBe(null);
      });
    });
  }
});
