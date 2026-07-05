import path from 'path';
import nunjucks from '../..';
import express from 'express';

const __dirname = import.meta.dirname;

const app = express();

nunjucks.configure(path.join(__dirname, 'views'), {
  autoescape: true,
  express: app
});

app.use(express.static(__dirname));

app.use((req, res, next) => {
  res.locals.user = 'hello';
  next();
});

app.get('/', (req, res) => {
  res.render('index.html', {
    username: 'James Long <strong>copyright</strong>'
  });
});

app.get('/about', (req, res) => {
  res.render('about.html');
});

app.listen(4000, () => {
  console.log('Express server running on http://localhost:4000');
});
