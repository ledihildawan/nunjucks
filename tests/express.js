import path from 'path';
import express from 'express';
import expect from 'expect.js';
import request from 'supertest';
import nunjucks from '../nunjucks/index.js';
import { fileURLToPath } from 'url';

var __dirname = path.dirname(fileURLToPath(import.meta.url));
var VIEWS = path.join(__dirname, '../samples/express/views');

describe('express', function() {
  var app;
  var env;

  beforeEach(function() {
    app = express();
    env = new nunjucks.Environment(new nunjucks.FileSystemLoader(VIEWS));
    env.express(app);
  });

  it('should have reference to nunjucks env', function() {
    expect(app.settings.nunjucksEnv).to.be(env);
  });

  it('should render a view with extension', async function() {
    app.get('/', async function(req, res) {
      await res.render('about.html');
    });
    await request(app)
      .get('/')
      .expect(/This is just the about page/);
  });

  it('should render a view without extension', async function() {
    app.get('/', async function(req, res) {
      await res.render('about');
    });
    app.set('view engine', 'html');
    await request(app)
      .get('/')
      .expect(/This is just the about page/);
  });
});
