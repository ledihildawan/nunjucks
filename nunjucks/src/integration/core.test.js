import { expect, describe, test, beforeAll, afterAll } from 'bun:test';
import { configure, reset, render } from '../../index.js';
import fs from 'fs';
import path from 'path';
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
  var tempdir;

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
    reset();
    if (typeof tempdir !== 'undefined') {
      rmdir(tempdir);
    }
  });

  test('should cache templates by default', async function() {
    configure(tempdir);

    fs.writeFileSync(tempdir + '/test.html', '{{ name }}', 'utf-8');
    expect(await render('test.html', {name: 'foo'})).toBe('foo');

    fs.writeFileSync(tempdir + '/test.html', '{{ name }}-changed', 'utf-8');
    expect(await render('test.html', {name: 'foo'})).toBe('foo');
  });

  test('should not cache templates with {noCache: true}', async function() {
    configure(tempdir, {noCache: true});

    fs.writeFileSync(tempdir + '/test.html', '{{ name }}', 'utf-8');
    expect(await render('test.html', {name: 'foo'})).toBe('foo');

    fs.writeFileSync(tempdir + '/test.html', '{{ name }}-changed', 'utf-8');
    expect(await render('test.html', {name: 'foo'})).toBe('foo-changed');
  });
});
