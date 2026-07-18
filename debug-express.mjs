import express from 'express';
import { createEngine } from './src/integrations/express.js';

const app = express();
const engine = createEngine({ dev: true });
app.engine('njk', (path, options, callback) => {
  options.undefined = 'strict';
  engine(path, options, callback);
});
app.set('views', './samples/express/views/errors');
app.set('view engine', 'njk');

// Use render with inline template like errors.js does
app.get('/errors/undefined-value-match', (req, res, next) => {
  const nunjucks = require('./src/index.js').default;
  nunjucks('{{ product.name }}', { product: null }, { dev: true, undefined: 'strict' })
    .then(html => {
      console.log('SUCCESS - should not happen');
      res.type('html').send(html);
    })
    .catch(err => {
      console.log('=== CAUGHT ERROR ===');
      console.log('lineno:', err.lineno);
      console.log('colno:', err.colno);
      console.log('lineBase:', err.lineBase);
      console.log('isJsCaller:', err.isJsCaller);
      console.log('message:', err.message);
      res.status(500).type('html').send(err.output ? err.output() : err.message);
    });
});

const server = app.listen(4000, () => {
  console.log('Server running');

  fetch('http://localhost:4000/errors/undefined-value-match')
    .then(r => r.text())
    .then(html => {
      console.log('\n=== HTML RESPONSE ===');
      // Extract error location
      const match = html.match(/undefined-value-match\.njk:(\d+):(\d+)/) || html.match(/product\.name.*:(\d+):(\d+)/);
      if (match) console.log('Found location in HTML:', match[0]);
      console.log('First 500 chars:', html.substring(0, 500));
      server.close();
      process.exit(0);
    })
    .catch(err => {
      console.error('Fetch failed:', err);
      server.close();
      process.exit(1);
    });
});