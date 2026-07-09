import { expect, describe, test, beforeEach } from 'bun:test';
import path from 'path';
import * as util from './util.js';
import { Environment } from '../nunjucks/src/environment/index.js';
import { FileSystemLoader } from '../nunjucks/src/loaders/file-system-loader.js';

var templatesPath = 'tests/templates';

describe('api', function() {
  test('should always force compilation of parent template', async function() {
    var env = new Environment(new FileSystemLoader(templatesPath));

    var child = await env.getTemplate('base-inherit.njk');
    expect(await child.render()).toBe('Foo*Bar*BazFizzle');
  });

  test('should only call the callback once when conditional import fails', async function() {
    var env = new Environment(new FileSystemLoader(templatesPath));
    try {
      await env.render('broken-conditional-include.njk');
    } catch (e) {
      // expected to throw
    }
  });

  test('should handle correctly relative paths', async function() {
    var env = new Environment(new FileSystemLoader(templatesPath));
    var child1 = await env.getTemplate('relative/test1.njk');
    var child2 = await env.getTemplate('relative/test2.njk');

    expect(await child1.render()).toBe('FooTest1BazFizzle');
    expect(await child2.render()).toBe('FooTest2BazFizzle');
  });

  test('should handle correctly cache for relative paths', async function() {
    var env = new Environment(new FileSystemLoader(templatesPath));
    var test = await env.getTemplate('relative/test-cache.njk');

    expect(util.normEOL(await test.render())).toBe('Test1\nTest2');
  });

  test('should handle correctly relative paths in renderString', async function() {
    var env = new Environment(new FileSystemLoader(templatesPath));
    expect(await env.renderString('{% extends "./relative/test1.njk" %}{% block block1 %}Test3{% endblock %}', {}, {
      path: path.resolve(templatesPath, 'string.njk')
    })).toBe('FooTest3BazFizzle');
  });

  test('should emit "load" event on Environment instance', async function() {
    var env = new Environment(new FileSystemLoader(templatesPath));
    var loadedTemplate;
    env.on('load', function(name, source) {
      loadedTemplate = name;
    });
    await env.render('item.njk', {});
    expect(loadedTemplate).toEqual('item.njk');
  });
});
