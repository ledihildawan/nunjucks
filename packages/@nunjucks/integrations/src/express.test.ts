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
  test('renders a fixture template via Express callback API', async () => {
    const viewsDirectory = await mkdtemp(join(tmpdir(), 'nunjucks-express-'));
    temporaryDirectories.push(viewsDirectory);
    const templatePath = join(viewsDirectory, 'greeting.njk');
    await writeFile(templatePath, '<h1>Hello {{ name }}</h1>');

    const rendered = await new Promise<string>((resolve, reject) => {
      createEngine()(templatePath, { name: 'Ada' }, (err, html) => {
        if (err) { reject(err); return; }
        resolve(html ?? '');
      });
    });

    expect(rendered).toContain('Hello Ada');
  });
});
