import { expect, describe, test, beforeAll, afterAll } from 'bun:test';
import { createEnvironment } from '../environment/index.js';
import { createFileSystemLoader } from '../loaders/file-system.js';
import fs from 'fs';
import path from 'node:path';
import os from 'os';

function rmdir(dirPath) {
  try {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      fs.unlinkSync(path.join(dirPath, file));
    }
    fs.rmdirSync(dirPath);
  } catch (e) {
    // ignore
  }
}

describe('configure', function() {
  let tempdir;
  let env;

  beforeAll(async function() {
    if (fs && path && os) {
      try {
        tempdir = fs.mkdtempSync(path.join(os.tmpdir(), 'templates'));
        fs.rmSync(tempdir, { recursive: true, force: true });
        fs.mkdirSync(tempdir);
      } catch (e) {
        rmdir(tempdir);
        throw e;
      }
    }
  });

  afterAll(async function() {
    if (typeof tempdir !== 'undefined') {
      rmdir(tempdir);
    }
  });

  test('should cache templates by default', async function() {
    const loader = createFileSystemLoader(tempdir);
    env = createEnvironment(loader);

    fs.writeFileSync(tempdir + '/test.html', '{{ name }}', 'utf-8');
    expect(await env.render('test.html', {name: 'foo'})).toBe('foo');

    fs.writeFileSync(tempdir + '/test.html', '{{ name }}-changed', 'utf-8');
    expect(await env.render('test.html', {name: 'foo'})).toBe('foo');
  });

  test('should not cache templates with {noCache: true}', async function() {
    const loader = createFileSystemLoader(tempdir, { noCache: true });
    env = createEnvironment(loader);

    fs.writeFileSync(tempdir + '/test.html', '{{ name }}', 'utf-8');
    expect(await env.render('test.html', {name: 'foo'})).toBe('foo');

    fs.writeFileSync(tempdir + '/test.html', '{{ name }}-changed', 'utf-8');
    expect(await env.render('test.html', {name: 'foo'})).toBe('foo-changed');
  });
});
