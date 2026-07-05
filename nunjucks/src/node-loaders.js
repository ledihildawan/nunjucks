import { existsSync, readFileSync } from 'node:fs';
import { normalize, resolve } from 'node:path';
import { createRequire } from 'node:module';
import Loader from './loader.js';
export {PrecompiledLoader} from './precompiled-loader.js';

const _require = createRequire(import.meta.url);

export class FileSystemLoader extends Loader {
  constructor(searchPaths, opts) {
    super();
    if (typeof opts === 'boolean') {
      console.log(
        '[nunjucks] Warning: you passed a boolean as the second ' +
        'argument to FileSystemLoader, but it now takes an options ' +
        'object. See http://mozilla.github.io/nunjucks/api.html#filesystemloader'
      );
    }

    opts = opts || {};
    this.pathsToNames = {};
    this.noCache = !!opts.noCache;
    this.async = true;

    if (searchPaths) {
      searchPaths = Array.isArray(searchPaths) ? searchPaths : [searchPaths];
      this.searchPaths = searchPaths.map(normalize);
    } else {
      this.searchPaths = ['.'];
    }
  }

  async getSource(name) {
    var fullpath = null;
    var paths = this.searchPaths;

    for (let i = 0; i < paths.length; i++) {
      const basePath = resolve(paths[i]);
      const p = resolve(paths[i], name);

      if (p.indexOf(basePath) === 0 && existsSync(p)) {
        fullpath = p;
        break;
      }
    }

    if (!fullpath) {
      return null;
    }

    this.pathsToNames[fullpath] = name;

    const source = {
      src: readFileSync(fullpath, 'utf-8'),
      path: fullpath,
      noCache: this.noCache
    };
    this.emit('load', name, source);
    return source;
  }
}

export class NodeResolveLoader extends Loader {
  constructor(opts) {
    super();
    opts = opts || {};
    this.pathsToNames = {};
    this.noCache = !!opts.noCache;
    this.paths = opts.paths || [];
    this.async = true;
  }

  async getSource(name) {
    if ((/^\.?\.?(\/|\\)/).test(name)) {
      return null;
    }
    if ((/^[A-Z]:/).test(name)) {
      return null;
    }

    let fullpath;

    try {
      fullpath = _require.resolve(name);
    } catch (e) {
      fullpath = this.resolveFromPaths(name);
      if (!fullpath) {
        return null;
      }
    }

    this.pathsToNames[fullpath] = name;

    const source = {
      src: readFileSync(fullpath, 'utf-8'),
      path: fullpath,
      noCache: this.noCache,
    };

    this.emit('load', name, source);
    return source;
  }

  resolveFromPaths(name) {
    for (const basePath of this.paths) {
      const fullPath = resolve(basePath, name);
      if (existsSync(fullPath)) {
        return fullPath;
      }
    }
    return null;
  }
}
