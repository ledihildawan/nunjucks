import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nunjucks } from '@nunjucks/core';
import { isOk } from '@nunjucks/lib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VIEWS = path.join(__dirname, 'views');

const njk = nunjucks({
  views: VIEWS,
  globals: {
    appName: 'Nunjucks App',
    version: '1.0.0',
  },
});

const helloResult = await njk.render('hello.njk', { name: 'World' });
console.log(isOk(helloResult) ? helloResult.value : helloResult.error);
const versionResult = await njk.render('{{ appName }} v{{ version }}');
console.log(isOk(versionResult) ? versionResult.value : versionResult.error);
