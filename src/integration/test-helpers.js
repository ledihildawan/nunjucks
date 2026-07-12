import { fileURLToPath } from 'url';
import path from 'node:path';
import { expect } from 'bun:test';
import { createEnvironment } from '../environment/index.js';
import { createTemplate } from '../template/index.js';
import { createFileSystemLoader } from '../loaders/file-system.js';
import installJinjaCompat from '../integration/jinja-compat.js';

const templatesPath = 'src/template/test-templates';

function equal(str, ctx, opts, str2, env) {
  if (typeof ctx === 'string') {
    env = opts;
    str2 = ctx;
    ctx = null;
    opts = {};
  }
  if (typeof opts === 'string') {
    env = str2;
    str2 = opts;
    opts = {};
  }
  opts = opts || {};
  const res = render(str, ctx, opts, env);
  if (res && typeof res.then === 'function') {
    return res.then((resolved) => {
      expect(resolved).toBe(str2);
    });
  }
  expect(res).toBe(str2);
}

function jinjaEqual(str, ctx, str2, env) {
  const jinjaUninstalls = [installJinjaCompat()];
  try {
    return equal(str, ctx, str2, env);
  } finally {
    for (let i = 0; i < jinjaUninstalls.length; i++) {
      jinjaUninstalls[i]();
    }
  }
}

function normEOL(str) {
  if (!str) {
    return str;
  }
  return str.replace(/\r\n|\r/g, '\n');
}

function render(str, ctx, opts, env, cb) {
  if (typeof ctx === 'function') {
    cb = ctx;
    ctx = null;
    opts = null;
    env = null;
  } else if (typeof opts === 'function') {
    cb = opts;
    opts = null;
    env = null;
  } else if (typeof env === 'function') {
    cb = env;
    env = null;
  }

  opts = opts || {};
  opts.dev = true;

  const loader = createFileSystemLoader(templatesPath);
  const e = env || createEnvironment(loader, opts);

  let name;
  if (opts.filters) {
    for (name in opts.filters) {
      if (Object.prototype.hasOwnProperty.call(opts.filters, name)) {
        e.addFilter(name, opts.filters[name]);
      }
    }
  }

  if (opts.extensions) {
    for (name in opts.extensions) {
      if (Object.prototype.hasOwnProperty.call(opts.extensions, name)) {
        e.addExtension(name, opts.extensions[name]);
      }
    }
  }

  ctx = ctx || {};

  const t = createTemplate(str, e);

  if (!cb) {
    return t.render(ctx);
  } else {
    t.render(ctx)
      .then(res => {
        cb(null, normEOL(res));
      })
      .catch(err => {
        if (err && !opts.noThrow) {
          throw err;
        }
        cb(err);
      });
  }
}

export { render, equal, jinjaEqual, normEOL };
