import { createFileSystemLoader, type FileSystemLoader } from '@nunjucks/loaders';

interface EngineConfig {
  dev?: boolean;
  views?: string;
  root?: string;
}

const loaderCache = new Map<string, FileSystemLoader>();

const getLoader = (config: EngineConfig): FileSystemLoader | null => {
  const viewsPath = config.views || config.root;
  if (!viewsPath) { return null; }

  const cached = loaderCache.get(viewsPath);
  if (cached) { return cached; }

  const loader = createFileSystemLoader(viewsPath);
  loaderCache.set(viewsPath, loader);
  return loader;
};

export { getLoader };
export type { EngineConfig };
