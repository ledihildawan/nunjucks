import expect from 'expect.js';
import path from 'path';
import * as util from './util.js';
import { Environment } from '../nunjucks/src/environment.js';
import { FileSystemLoader } from '../nunjucks/src/node-loaders.js';

var templatesPath = 'tests/templates';

describe('api', function() {
  it('should always force compilation of parent template', async function() {
    var env = new Environment(new FileSystemLoader(templatesPath));

    var child = await env.getTemplate('base-inherit.njk');
    expect(await child.render()).to.be('Foo*Bar*BazFizzle');
  });

  it('should only call the callback once when conditional import fails', async function() {
    var env = new Environment(new FileSystemLoader(templatesPath));
    var called = 0;
    env.render('broken-conditional-include.njk',
      function() {
        called++;
      }
    );
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(called).to.be(1);
  });

  it('should handle correctly relative paths', async function() {
    var env = new Environment(new FileSystemLoader(templatesPath));
    var child1 = await env.getTemplate('relative/test1.njk');
    var child2 = await env.getTemplate('relative/test2.njk');

    expect(await child1.render()).to.be('FooTest1BazFizzle');
    expect(await child2.render()).to.be('FooTest2BazFizzle');
  });

  it('should handle correctly cache for relative paths', async function() {
    var env = new Environment(new FileSystemLoader(templatesPath));
    var test = await env.getTemplate('relative/test-cache.njk');

    expect(util.normEOL(await test.render())).to.be('Test1\nTest2');
  });

  it('should handle correctly relative paths in renderString', async function() {
    var env = new Environment(new FileSystemLoader(templatesPath));
    expect(await env.renderString('{% extends "./relative/test1.njk" %}{% block block1 %}Test3{% endblock %}', {}, {
      path: path.resolve(templatesPath, 'string.njk')
    })).to.be('FooTest3BazFizzle');
  });

  it('should emit "load" event on Environment instance', async function() {
    var env = new Environment(new FileSystemLoader(templatesPath));
    var loadedTemplate;
    env.on('load', function(name, source) {
      loadedTemplate = name;
    });
    await env.render('item.njk', {});
    expect(loadedTemplate).to.equal('item.njk');
  });
});
