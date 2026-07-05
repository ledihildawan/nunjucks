import { precompile } from '../../nunjucks/src/precompile.js';
import fs from 'fs';
import path from 'path';

const __dirname = import.meta.dirname;

const testDir = path.join(__dirname, '../../tests');

export function precompileTestTemplates() {
  return new Promise((resolve, reject) => {
    try {
      const output = precompile(path.join(testDir, 'templates'), {
        include: [/\.(njk|html)$/],
      });
      fs.writeFileSync(path.join(testDir, 'browser/precompiled-templates.js'), output);
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}
