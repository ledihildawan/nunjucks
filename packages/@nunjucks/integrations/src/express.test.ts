import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEngine } from './express.ts';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

describe('Express integration', () => {
  test('renders a fixture template via Express callback API', async () => {
    const viewsDirectory = await mkdtemp(join(tmpdir(), 'nunjucks-express-'));
    temporaryDirectories.push(viewsDirectory);
    const templatePath = join(viewsDirectory, 'greeting.njk');
    await writeFile(templatePath, '<h1>Hello {{ name }}</h1>');

    const rendered = await new Promise<string>((resolve, reject) => {
      createEngine()(templatePath, { name: 'Ada' }, (err, html) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(html ?? '');
      });
    });

    expect(rendered).toContain('Hello Ada');
  });

  test('strips Express-internal option keys from the render context', async () => {
    const viewsDirectory = await mkdtemp(join(tmpdir(), 'nunjucks-express-'));
    temporaryDirectories.push(viewsDirectory);
    const templatePath = join(viewsDirectory, 'internal-keys.njk');
    await writeFile(
      templatePath,
      '<span>{{ name }}:{% if settings is defined %}LEAK{% endif %}{% if cache is defined %}LEAK{% endif %}{% if _locals is defined %}LEAK{% endif %}</span>'
    );

    const rendered = await new Promise<string>((resolve, reject) => {
      createEngine()(
        templatePath,
        { name: 'Ada', settings: { env: 'test' }, cache: true, _locals: {} },
        (err, html) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(html ?? '');
        }
      );
    });

    expect(rendered).toBe('<span>Ada:</span>');
  });

  test('renders an empty context for non-object options', async () => {
    const viewsDirectory = await mkdtemp(join(tmpdir(), 'nunjucks-express-'));
    temporaryDirectories.push(viewsDirectory);
    const templatePath = join(viewsDirectory, 'plain-object.njk');
    await writeFile(templatePath, '<em>{% if name is defined %}LEAK{% endif %}ok</em>');

    const rendered = await new Promise<string>((resolve, reject) => {
      createEngine()(templatePath, null, (err, html) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(html ?? '');
      });
    });

    expect(rendered).toBe('<em>ok</em>');
  });

  test('merges settings["view options"] as default engine options (per-call values win)', async () => {
    const viewsDirectory = await mkdtemp(join(tmpdir(), 'nunjucks-express-'));
    temporaryDirectories.push(viewsDirectory);
    const templatePath = join(viewsDirectory, 'viewopts.njk');
    await writeFile(templatePath, '<p>{{ name }}</p>');

    // WHY: fake settings bag mirroring what Express injects into the options —
    // view options must act as per-app defaults and never leak into the context.
    const rendered = await new Promise<string>((resolve, reject) => {
      createEngine()(
        templatePath,
        {
          name: 'Ada',
          settings: { 'view options': { executionTimeout: 5000, junk: 'ignored' } },
        },
        (err, html) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(html ?? '');
        }
      );
    });

    expect(rendered).toBe('<p>Ada</p>');
  });

  test('broken template surfaces the error via the callback (Result err path)', async () => {
    const viewsDirectory = await mkdtemp(join(tmpdir(), 'nunjucks-express-'));
    temporaryDirectories.push(viewsDirectory);
    const templatePath = join(viewsDirectory, 'broken.njk');
    await writeFile(templatePath, '{% if %}');

    const error = await new Promise<Error | null>((resolve) => {
      createEngine()(templatePath, {}, (err) => resolve(err));
    });

    expect(error).toBeInstanceOf(Error);
  });

  test('missing template file with a view extension surfaces FILE_NOT_FOUND', async () => {
    const viewsDirectory = await mkdtemp(join(tmpdir(), 'nunjucks-express-'));
    temporaryDirectories.push(viewsDirectory);
    const missingPath = join(viewsDirectory, 'does-not-exist.njk');

    const error = await new Promise<Error | null>((resolve) => {
      createEngine()(missingPath, {}, (err) => resolve(err));
    });

    // WHY: an extension-bearing miss under a configured views loader is a typo'd file
    // reference — the old behavior rendered the literal filename as a 200 page.
    expect(error).toBeInstanceOf(Error);
    expect((error as { code?: string }).code).toBe('FILE_NOT_FOUND');
  });
});
