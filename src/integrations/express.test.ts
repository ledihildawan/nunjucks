import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEngine } from './express.ts';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe('Express integration', () => {
  test('renders a fixture template through the Express callback', async () => {
    const viewsDirectory = await mkdtemp(join(tmpdir(), 'nunjucks-express-'));
    temporaryDirectories.push(viewsDirectory);
    const templatePath = join(viewsDirectory, 'greeting.njk');
    await writeFile(templatePath, '<h1>Hello {{ name }}</h1>');

    const html = await new Promise<string>((resolve, reject) => {
      createEngine()(templatePath, { name: 'Ada' }, (error, renderedHtml) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(renderedHtml ?? '');
      });
    });

    expect(html).toContain('Hello Ada');
  });
});
