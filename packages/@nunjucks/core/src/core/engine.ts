import { createFileSystemLoader, type FileSystemLoader } from '@nunjucks/loaders';

interface EngineConfig {
  dev?: boolean;
  views?: string;
  root?: string;
}

interface Engine {
  getLoader: (cfg: EngineConfig) => FileSystemLoader | null;
}

const createEngine = (): Engine => {
  let cachedLoader: FileSystemLoader | null = null;
  let cachedViewsPath: string | null = null;

  return {
    getLoader: (cfg: EngineConfig) => {
      const viewsPath = cfg.views || cfg.root;
      if (!viewsPath) { return null; }

      if (cachedLoader && cachedViewsPath === viewsPath) {
        return cachedLoader;
      }

      cachedLoader = createFileSystemLoader(viewsPath, { noCache: cfg.dev });
      cachedViewsPath = viewsPath;
      return cachedLoader;
    }
  };
};

const defaultEngine = createEngine();

const getLoader = (config: EngineConfig): FileSystemLoader | null => defaultEngine.getLoader(config);

export { createEngine, getLoader };
export type { EngineConfig, Engine };
