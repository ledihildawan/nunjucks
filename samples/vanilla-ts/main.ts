import path from 'path';
import { fileURLToPath } from 'url';
import { render } from '@nunjucks/core';

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

console.log(await render('hello.njk', { name: 'World' }, config));
console.log(await render('{{ appName }} v{{ version }}', {}, config));
