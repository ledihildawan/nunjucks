#!/usr/bin/env node

import { precompileString } from '../..';
import fs from 'fs';
import path from 'path';

const __dirname = import.meta.dirname;

const baseTmpl = precompileString(
  fs.readFileSync(path.join(__dirname, 'views/base.html'), 'utf-8'), {
    name: 'base.html',
    asFunction: true
  });

const aboutTmpl = precompileString(
  fs.readFileSync(path.join(__dirname, 'views/about.html'), 'utf-8'), {
    name: 'about.html',
    asFunction: true
  });

const out = 'window.baseTmpl = ' + baseTmpl + ';\nwindow.aboutTmpl = ' + aboutTmpl + ';';

fs.writeFileSync(path.join(__dirname, 'js/templates.js'), out, 'utf-8');

fs.writeFileSync(
  path.join(__dirname, 'js/nunjucks.js'),
  fs.readFileSync(path.join(__dirname, '../../browser/nunjucks.js'), 'utf-8'),
  'utf-8'
);
