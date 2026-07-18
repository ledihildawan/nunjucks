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

app.get('/errors/undefined-variable', (req, res) => {
  res.render('undefined-variable.njk', { app_name: 'MyApp' });
});

app.listen(4000, () => console.log('Server running on http://localhost:4000'));