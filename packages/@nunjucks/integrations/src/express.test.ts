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

  test('missing template file falls back to inline rendering (no error)', async () => {
    const viewsDirectory = await mkdtemp(join(tmpdir(), 'nunjucks-express-'));
    temporaryDirectories.push(viewsDirectory);
    const missingPath = join(viewsDirectory, 'does-not-exist.njk');

    const outcome = await new Promise<{ err: Error | null; html?: string }>((resolve) => {
      createEngine()(missingPath, {}, (err, html) => resolve({ err, html }));
    });

    // WHY: engine by-design — a loader miss without template syntax falls back to
    // rendering the name as inline text, so Express receives a successful literal
    // render rather than a load error.
    expect(outcome.err).toBeNull();
    expect(outcome.html).toBe('does-not-exist.njk');
  });
});
