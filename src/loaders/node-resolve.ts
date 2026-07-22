import { pipe } from 'remeda';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createLoader, Loader } from './base.js';

const _require = createRequire(import.meta.url);

const isRelativePath = pipe(
  (name: string) => (/^\.?\.?(\/|\\)/).test(name)
);

const isWindowsAbsolutePath = pipe(
  (name: string) => (/^[A-Z]:/).test(name)
);

const isExternalModule = (name: string) => !isRelativePath(name) && !isWindowsAbsolutePath(name);

const tryRequireResolve = (name: string): string | null => {
  try { return _require.resolve(name); }
  catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'MODULE_NOT_FOUND') return null;
    throw e;
  }
};

const findInSearchPaths = (searchPaths: string[], name: string): string | null => {
  for (const basePath of searchPaths) {
    const fullPath = path.resolve(basePath, name);
    if (existsSync(fullPath)) return fullPath;
  }
  return null;
};

const readSource = (fullpath: string, noCache: boolean) => ({
  src: readFileSync(fullpath, 'utf-8'),
  path: fullpath,
  noCache
});

export interface NodeResolveLoaderSource {
  src: string;
  path: string;
  noCache?: boolean;
}

export interface NodeResolveLoaderOptions {
  noCache?: boolean;
  paths?: string[];
}

export interface NodeResolveLoader extends Loader {
  pathsToNames: Record<string, string>;
  noCache: boolean;
  paths: string[];
  async: true;
  getSource(name: string): Promise<NodeResolveLoaderSource | null>;
}

export function createNodeResolveLoader(opts: NodeResolveLoaderOptions = {}): NodeResolveLoader {
  const loader = createLoader() as NodeResolveLoader;
  loader.pathsToNames = {};
  loader.noCache = Boolean(opts.noCache);
  loader.paths = opts.paths ?? [];
  loader.async = true;

  loader.getSource = async (name: string): Promise<NodeResolveLoaderSource | null> => {
    if (!isExternalModule(name)) return null;

    let fullpath = tryRequireResolve(name);
    if (!fullpath) {
      fullpath = findInSearchPaths(loader.paths, name);
      if (!fullpath) return null;
    }

    loader.pathsToNames[fullpath] = name;
    const source = readSource(fullpath, loader.noCache);
    loader.emit('load', name, source);
    return source;
  };

  return loader;
}
