import { expect, describe, test, beforeEach } from 'bun:test';
import path from 'node:path';
import * as util from './util.js';
import { createEnvironment } from '../environment/index.js';
import { createFileSystemLoader } from '../loaders/file-system.js';
import { createContainer } from '../../src/index.js';

var templatesPath = 'src/template/test-templates';

const configure = (templatesPath, opts = {}) => {
  const loader = createFileSystemLoader(templatesPath, {
    watch: opts.watch,
    noCache: opts.noCache
  });
  return createEnvironment(loader, opts);
};

describe('api', function() {
  test('should always force compilation of parent template', async function() {
    var env = createEnvironment(createFileSystemLoader(templatesPath));

    var child = await env.getTemplate('base-inherit.njk');
    expect(await child.render()).toBe('Foo*Bar*BazFizzle');
  });

  test('should only call the callback once when conditional import fails', async function() {
    var env = createEnvironment(createFileSystemLoader(templatesPath));
    try {
      await env.render('broken-conditional-include.njk');
    } catch (e) {
      // expected to throw
    }
  });

  test('should handle correctly relative paths', async function() {
    var env = createEnvironment(createFileSystemLoader(templatesPath));
    var child1 = await env.getTemplate('relative/test1.njk');
    var child2 = await env.getTemplate('relative/test2.njk');

    expect(await child1.render()).toBe('FooTest1BazFizzle');
    expect(await child2.render()).toBe('FooTest2BazFizzle');
  });

  test('should handle correctly cache for relative paths', async function() {
    var env = createEnvironment(createFileSystemLoader(templatesPath));
    var test = await env.getTemplate('relative/test-cache.njk');

    expect(util.normEOL(await test.render())).toBe('Test1\nTest2');
  });

  test('should handle correctly relative paths in renderString', async function() {
    var env = createEnvironment(createFileSystemLoader(templatesPath));
    expect(await env.renderString('{% extends "./relative/test1.njk" %}{% block block1 %}Test3{% endblock %}', {}, {
      path: path.resolve(templatesPath, 'string.njk')
    })).toBe('FooTest3BazFizzle');
  });

  test('should emit "load" event on Environment instance', async function() {
    var env = createEnvironment(createFileSystemLoader(templatesPath));
    var loadedTemplate;
    env.on('load', function(name, source) {
      loadedTemplate = name;
    });
    await env.render('item.njk', {});
    expect(loadedTemplate).toEqual('item.njk');
  });
});

describe('auto error handling in dev mode', () => {
  test('env.render returns HTML error in dev mode instead of throwing', async () => {
    const env = configure('src/template/test-templates', {
      dev: true,
      undefined: 'strict'
    });

    const result = await env.render('throws.njk', {});
    expect(result).toContain('Error:');
    expect(result).toContain('UNDEFINED_FUNCTION');
  });

  test('env.render throws in production mode', async () => {
    const env = configure('src/template/test-templates', {
      dev: false,
      undefined: 'strict'
    });

    await expect(env.render('throws.njk', {})).rejects.toThrow();
  });

  test('env.renderString returns HTML error in dev mode instead of throwing', async () => {
    const env = configure('src/template/test-templates', {
      dev: true,
      undefined: 'strict'
    });

    const result = await env.renderString('{{ undefined_var }}', {});
    expect(result).toContain('Error:');
    expect(result).toContain('UNDEFINED_VARIABLE');
  });

  test('env.renderString throws in production mode', async () => {
    const env = configure('src/template/test-templates', {
      dev: false,
      undefined: 'strict'
    });

    await expect(env.renderString('{{ undefined_var }}', {})).rejects.toThrow();
  });

  test('render context with blocked keys is filtered in error output', async () => {
    const env = configure('src/template/test-templates', {
      dev: true,
      undefined: 'strict'
    });

    const result = await env.renderString('{{ user.name }}', {
      user: {
        name: 'Alice',
        __proto__: { dangerous: true },
        constructor: { dangerous: true }
      }
    });
    expect(result).toContain('Alice');
    expect(result).not.toContain('__proto__');
    expect(result).not.toContain('constructor');
  });
});
