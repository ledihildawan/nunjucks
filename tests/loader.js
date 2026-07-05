import expect from 'expect.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { Environment } from '../nunjucks/src/environment.js';
import { WebLoader } from '../nunjucks/src/web-loaders.js';
import { FileSystemLoader } from '../nunjucks/src/node-loaders.js';
import { NodeResolveLoader } from '../nunjucks/src/node-loaders.js';

var templatesPath = 'tests/templates';

describe('loader', function() {
  it('should allow a simple loader to be created', async function() {
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
    expect(await parent.render()).to.be('Hello World');
  });

  it('should catch loader error', async function() {
    function MyLoader() {
      this.async = true;
    }

    MyLoader.prototype.getSource = function(s, cb) {
      setTimeout(function() {
        cb(new Error('test'));
      }, 1);
    };

    var env = new Environment(new MyLoader(templatesPath));
    await new Promise((resolve, reject) => {
      env.getTemplate('fake.njk', function(err, parent) {
        expect(err).to.be.a(Error);
        expect(parent).to.be(undefined);
        resolve();
      });
    });
  });

  describe('WebLoader', function() {
    it('should have default opts for WebLoader', function() {
      var webLoader = new WebLoader(templatesPath);
      expect(webLoader).to.be.a(WebLoader);
      expect(webLoader.useCache).to.be(false);
      expect(webLoader.async).to.be(false);
    });

    it('should emit a "load" event', function() {
      if (typeof window === 'undefined') {
        return;
      }
      var loader = new WebLoader(templatesPath);
      var loadedTemplate;
      loader.on('load', function(name, source) {
        loadedTemplate = name;
      });
      loader.getSource('simple-base.njk');
      expect(loadedTemplate).to.equal('simple-base.njk');
    });
  });

  if (typeof FileSystemLoader !== 'undefined') {
    describe('FileSystemLoader', function() {
      it('should have default opts', function() {
        var loader = new FileSystemLoader(templatesPath);
        expect(loader).to.be.a(FileSystemLoader);
        expect(loader.noCache).to.be(false);
      });

      it('should emit a "load" event', async function() {
        var loader = new FileSystemLoader(templatesPath);
        var loadedTemplate;
        loader.on('load', function(name, source) {
          loadedTemplate = name;
        });
        loader.getSource('simple-base.njk');
        expect(loadedTemplate).to.equal('simple-base.njk');
      });
    });
  }

  if (typeof NodeResolveLoader !== 'undefined') {
    describe('NodeResolveLoader', function() {
      it('should have default opts', function() {
        var loader = new NodeResolveLoader();
        expect(loader).to.be.a(NodeResolveLoader);
        expect(loader.noCache).to.be(false);
      });

      it('should emit a "load" event', async function() {
        var loader = new NodeResolveLoader({paths: [path.join(path.dirname(fileURLToPath(import.meta.url)), 'test-node-pkgs')]});
        var loadedTemplate;
        loader.on('load', function(name, source) {
          loadedTemplate = name;
        });
        loader.getSource('dummy-pkg/simple-template.html');
        expect(loadedTemplate).to.equal('dummy-pkg/simple-template.html');
      });

      it('should render templates', async function() {
        var env = new Environment(new NodeResolveLoader({paths: [path.join(path.dirname(fileURLToPath(import.meta.url)), 'test-node-pkgs')]}));
        var tmpl = await env.getTemplate('dummy-pkg/simple-template.html');
        expect(await tmpl.render({foo: 'foo'})).to.be('foo');
      });

      it('should not allow directory traversal', function() {
        var loader = new NodeResolveLoader({paths: [path.join(path.dirname(fileURLToPath(import.meta.url)), 'test-node-pkgs')]});
        var dummyPkgPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'test-node-pkgs', 'dummy-pkg', 'simple-template.html');
        expect(loader.getSource(dummyPkgPath)).to.be(null);
      });

      it('should return null if no match', function() {
        var loader = new NodeResolveLoader();
        var tmplName = 'dummy-pkg/does-not-exist.html';
        expect(loader.getSource(tmplName)).to.be(null);
      });
    });
  }
});
