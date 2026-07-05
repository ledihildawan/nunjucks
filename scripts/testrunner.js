#!/usr/bin/env node

import NYC from 'nyc';

process.env.NODE_ENV = 'test';

const nyc = new NYC({
  exclude: ['*.min.js', 'scripts/**', 'tests/**'],
  reporter: ['text', 'html', 'lcovonly'],
  showProcessTree: true
});
nyc.reset();

import '@babel/register';

import runtests from './lib/runtests.js';
import precompileTestTemplates from './lib/precompile.js';

let err;

precompileTestTemplates()
  .then(() => runtests())
  .catch((e) => {
    err = e;
    console.log(err);
  })
  .then(() => {
    nyc.writeCoverageFile();
    nyc.report();

    if (err) {
      process.exit(1);
    }
  });
