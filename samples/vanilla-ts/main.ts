import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from '@nunjucks/core';
import { isOk } from '@nunjucks/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VIEWS = path.join(__dirname, 'views');

const config = {
  views: VIEWS,
  globals: {
    appName: 'Nunjucks App',
    version: '1.0.0',
  },
};

const a = await render('hello.njk', { name: 'World' }, config);
console.log(isOk(a) ? a.value : a.error);
const b = await render('{{ appName }} v{{ version }}', {}, config);
console.log(isOk(b) ? b.value : b.error);
