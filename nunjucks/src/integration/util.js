import { fileURLToPath } from 'url';
import path from 'path';
import { expect } from 'bun:test';
import {
  createEnvironment,
  createTemplate,
  createFileSystemLoader,
  precompileString,
  installJinjaCompat,
} from '../../index.js';

const Environment = createEnvironment;
const Template = createTemplate;
const Loader = createFileSystemLoader;

var isSlim = false;
var templatesPath = 'src/template/test-templates';

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
  var res = render(str, ctx, opts, env);
  if (res && typeof res.then === 'function') {
    return res.then((resolved) => {
      expect(resolved).toBe(str2);
    });
  }
  expect(res).toBe(str2);
}

function jinjaEqual(str, ctx, str2, env) {
  var jinjaUninstalls = [installJinjaCompat()];
  try {
    return equal(str, ctx, str2, env);
  } finally {
    for (var i = 0; i < jinjaUninstalls.length; i++) {
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

function randomTemplateName() {
  var rand = Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 5);
  return rand + '.njk';
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

  var loader;
  var e;

  if (isSlim) {
    e = env || new Environment([], opts);
    loader = e.loaders[0];
  } else {
    loader = new Loader(templatesPath);
    e = env || new Environment(loader, opts);
  }

  var name;
  if (opts.filters) {
    for (name in opts.filters) {
      if (Object.prototype.hasOwnProperty.call(opts.filters, name)) {
        e.addFilter(name, opts.filters[name]);
      }
    }
  }

  if (opts.asyncFilters) {
    for (name in opts.asyncFilters) {
      if (Object.prototype.hasOwnProperty.call(opts.asyncFilters, name)) {
        e.addFilter(name, opts.asyncFilters[name], true);
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

  var tmplName;
  if (isSlim) {
    tmplName = randomTemplateName();
    var precompileJs = precompileString(str, {
      name: tmplName,
      asFunction: true,
      env: e
    });
    eval(precompileJs);
  }

  ctx = ctx || {};

  var t;

  if (isSlim) {
    var tmplSource = loader.getSource(tmplName);
    t = Template(tmplSource.src, e, tmplSource.path);
  } else {
    t = Template(str, e);
  }

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

export { render, equal, jinjaEqual, normEOL, isSlim, Loader };
