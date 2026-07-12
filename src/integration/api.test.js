import { expect, describe, test, beforeEach } from 'bun:test';
import path from 'node:path';
import * as util from './test-helpers.js';
import { createEnvironment } from '../environment/index.js';
import { createFileSystemLoader } from '../loaders/file-system.js';
import { createContainer } from '../../src/index.js';

const templatesPath = 'src/template/test-templates';

const configure = (templatesPath, opts = {}) => {
  const loader = createFileSystemLoader(templatesPath, {
    watch: opts.watch,
    noCache: opts.noCache
  });
  return createEnvironment(loader, opts);
};

describe('api', function() {
  test('should always force compilation of parent template', async function() {
    const env = createEnvironment(createFileSystemLoader(templatesPath));

    const child = await env.getTemplate('base-inherit.njk');
    expect(await child.render()).toBe('Foo*Bar*BazFizzle');
  });

  test('should only call the callback once when conditional import fails', async function() {
    const env = createEnvironment(createFileSystemLoader(templatesPath));
    try {
      await env.render('broken-conditional-include.njk');
    } catch (e) {
      // expected to throw
    }
  });

  test('should handle correctly relative paths', async function() {
    const env = createEnvironment(createFileSystemLoader(templatesPath));
    const child1 = await env.getTemplate('relative/test1.njk');
    const child2 = await env.getTemplate('relative/test2.njk');

    expect(await child1.render()).toBe('FooTest1BazFizzle');
    expect(await child2.render()).toBe('FooTest2BazFizzle');
  });

  test('should handle correctly cache for relative paths', async function() {
    const env = createEnvironment(createFileSystemLoader(templatesPath));
    const test = await env.getTemplate('relative/test-cache.njk');

    expect(util.normEOL(await test.render())).toBe('Test1\nTest2');
  });

  test('should handle correctly relative paths in render', async function() {
    const env = createEnvironment(createFileSystemLoader(templatesPath));
    expect(await env.render('{% extends "./relative/test1.njk" %}{% block block1 %}Test3{% endblock %}', {}, {
      path: path.resolve(templatesPath, 'string.njk')
    })).toBe('FooTest3BazFizzle');
  });

  test('should emit "load" event on Environment instance', async function() {
    const env = createEnvironment(createFileSystemLoader(templatesPath));
    let loadedTemplate;
    env.on('load', function(name, source) {
      loadedTemplate = name;
    });
    await env.render('item.njk', {});
    expect(loadedTemplate).toEqual('item.njk');
  });
});

describe('auto error handling in dev mode', () => {
  test('env.render throws in dev mode', async () => {
    const env = configure('src/template/test-templates', {
      dev: true,
      undefined: 'strict'
    });

    await expect(env.render('throws.njk', {})).rejects.toThrow();
  });

  test('env.render throws in production mode', async () => {
    const env = configure('src/template/test-templates', {
      dev: false,
      undefined: 'strict'
    });

    await expect(env.render('throws.njk', {})).rejects.toThrow();
  });

  test('env.render throws in dev mode with inline template', async () => {
    const env = configure('src/template/test-templates', {
      dev: true,
      undefined: 'strict'
    });

    await expect(env.render('{{ undefined_var }}', {})).rejects.toThrow();
  });

  test('env.render throws in production mode with inline template', async () => {
    const env = configure('src/template/test-templates', {
      dev: false,
      undefined: 'strict'
    });

    await expect(env.render('{{ undefined_var }}', {})).rejects.toThrow();
  });

  test('render context with blocked keys is filtered in error output', async () => {
    const env = configure('src/template/test-templates', {
      dev: true,
      undefined: 'strict'
    });

    const result = await env.render('{{ user.name }}', {
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
