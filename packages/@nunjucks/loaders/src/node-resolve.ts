import { pipe } from 'remeda';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createLoader, type Loader } from './base.ts';

const _require = createRequire(import.meta.url);

const RELATIVE_PATH_RE = /^\.?\.?(\/|\\)/;
const WINDOWS_ABSOLUTE_PATH_RE = /^[A-Z]:/;

const isRelativePath = pipe(
  (name: string) => RELATIVE_PATH_RE.test(name)
);

const isWindowsAbsolutePath = pipe(
  (name: string) => WINDOWS_ABSOLUTE_PATH_RE.test(name)
);

const isExternalModule = (name: string) => !(isRelativePath(name) || isWindowsAbsolutePath(name));

const tryRequireResolve = (name: string): string | null => {
  try {
    return _require.resolve(name);
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'MODULE_NOT_FOUND') { return null; }
    throw e;
  }
};

const exists = async (fullPath: string): Promise<boolean> =>
  access(fullPath).then(() => true, () => false);

const findInSearchPaths = async (searchPaths: string[], name: string): Promise<string | null> => {
  for (const basePath of searchPaths) {
    const fullPath = path.resolve(basePath, name);
    // Sequential on purpose: the first search path that has the file wins.
    if (await exists(fullPath)) { return fullPath; }
  }
  return null;
};

const readSource = async (fullpath: string, noCache: boolean): Promise<NodeResolveLoaderSource> => ({
  src: await readFile(fullpath, 'utf-8'),
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
  getSource: (name: string) => Promise<NodeResolveLoaderSource | null>;
}

export function createNodeResolveLoader(opts: NodeResolveLoaderOptions = {}): NodeResolveLoader {
  const loader = createLoader() as NodeResolveLoader;
  loader.pathsToNames = {};
  loader.noCache = Boolean(opts.noCache);
  loader.paths = opts.paths ?? [];
  loader.async = true;

  loader.getSource = async (name: string): Promise<NodeResolveLoaderSource | null> => {
    if (!isExternalModule(name)) { return null; }

    const fullpath = tryRequireResolve(name) ?? await findInSearchPaths(loader.paths, name);
    if (!fullpath) { return null; }

    loader.pathsToNames[fullpath] = name;
    const source = await readSource(fullpath, loader.noCache);
    loader.emit('load', name, source);
    return source;
  };

  return loader;
}
