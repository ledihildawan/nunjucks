import { expect, describe, test, beforeEach, afterEach } from 'bun:test';
import path from 'path';
import express from 'express';
import nunjucks from '../../../../nunjucks/index.js';
import { fileURLToPath } from 'url';

var __dirname = path.dirname(fileURLToPath(import.meta.url));
var VIEWS = path.join(__dirname, '../../../../samples/express/views');

describe('express', function() {
  var app;
  var env;
  var server;
  var baseUrl;

  beforeEach(async function() {
    app = express();
    env = new nunjucks.Environment(new nunjucks.FileSystemLoader(VIEWS), {
      autoescape: true
    });

    await new Promise((resolve) => {
      server = app.listen(0, resolve);
    });
    baseUrl = `http://localhost:${server.address().port}`;
  });

  afterEach(function() {
    if (server) {
      server.close();
    }
  });

  test('should render a view with extension', async function() {
    app.get('/', async function(req, res) {
      const html = await env.render('about.html');
      res.send(html);
    });

    const res = await fetch(baseUrl);
    const text = await res.text();
    expect(text).toContain('This is just the about page');
  });

  test('should render a view with locals', async function() {
    app.get('/', async function(req, res) {
      const html = await env.renderString('Hello {{ name }}!', { name: 'World' });
      res.send(html);
    });

    const res = await fetch(baseUrl);
    const text = await res.text();
    expect(text).toContain('Hello World!');
  });
});
