import fs from 'fs';
import path from 'path';
import {_prettifyError} from './lib.js';
import * as compiler from './compiler.js';
import {Environment} from './environment.js';
import precompileGlobal from './precompile-global.js';

function match(filename, patterns) {
  if (!Array.isArray(patterns)) {
    return false;
  }
  return patterns.some((pattern) => filename.match(pattern));
}

export function precompileString(str, opts) {
  opts = opts || {};
  opts.isString = true;
  const env = opts.env || new Environment([]);
  const wrapper = opts.wrapper || precompileGlobal;

  if (!opts.name) {
    throw new Error('the "name" option is required when compiling a string');
  }
  return wrapper([_precompile(str, opts.name, env)], opts);
}

export function precompile(input, opts) {
  opts = opts || {};
  const env = opts.env || new Environment([]);
  const wrapper = opts.wrapper || precompileGlobal;

  if (opts.isString) {
    return precompileString(input, opts);
  }

  const pathStats = fs.existsSync(input) && fs.statSync(input);
  const precompiled = [];
  const templates = [];

  function addTemplates(dir) {
    fs.readdirSync(dir).forEach((file) => {
      const filepath = path.join(dir, file);
      let subpath = filepath.substr(path.join(input, '/').length);
      const stat = fs.statSync(filepath);

      if (stat && stat.isDirectory()) {
        subpath += '/';
        if (!match(subpath, opts.exclude)) {
          addTemplates(filepath);
        }
      } else if (match(subpath, opts.include)) {
        templates.push(filepath);
      }
    });
  }

  if (pathStats.isFile()) {
    precompiled.push(_precompile(
      fs.readFileSync(input, 'utf-8'),
      opts.name || input,
      env
    ));
  } else if (pathStats.isDirectory()) {
    addTemplates(input);

    for (let i = 0; i < templates.length; i++) {
      const name = templates[i].replace(path.join(input, '/'), '');

      try {
        precompiled.push(_precompile(
          fs.readFileSync(templates[i], 'utf-8'),
          name,
          env
        ));
      } catch (e) {
        if (opts.force) {
          console.error(e);
        } else {
          throw e;
        }
      }
    }
  }

  return wrapper(precompiled, opts);
}

function _precompile(str, name, env) {
  env = env || new Environment([]);

  const asyncFilters = env.asyncFilters;
  const extensions = env.extensionsList;
  let template;

  name = name.replace(/\\/g, '/');

  try {
    template = compiler.compile(str,
      asyncFilters,
      extensions,
      name,
      env.opts);
  } catch (err) {
    throw _prettifyError(name, false, err);
  }

  return {
    name: name,
    template: template
  };
}
