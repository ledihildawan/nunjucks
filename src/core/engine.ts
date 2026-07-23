import { createFileSystemLoader, type FileSystemLoader } from '../loaders/index.js';

export interface EngineConfig {
  dev?: boolean;
  views?: string;
  root?: string;
}

export interface Engine {
  getLoader: (cfg: EngineConfig) => FileSystemLoader | null;
}

export const createEngine = (): Engine => {
  let cachedLoader: FileSystemLoader | null = null;
  let cachedViewsPath: string | null = null;

  return {
    getLoader: (cfg: EngineConfig) => {
      const viewsPath = cfg.views || cfg.root;
      if (!viewsPath) return null;

      if (cachedLoader && cachedViewsPath === viewsPath) {
        return cachedLoader;
      }

      cachedLoader = createFileSystemLoader(viewsPath, { noCache: cfg.dev || false });
      cachedViewsPath = viewsPath;
      return cachedLoader;
    }
  };
};

const defaultEngine = createEngine();

export const getLoader = (config: EngineConfig): FileSystemLoader | null => defaultEngine.getLoader(config);
