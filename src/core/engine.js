import { createFileSystemLoader } from '../loaders/index.js';

export const createEngine = (config = {}) => {
  let cachedLoader = null;
  let cachedViewsPath = null;

  return {
    getLoader: (cfg) => {
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

const defaultEngine = createEngine({});

export const getLoader = (config) => defaultEngine.getLoader(config);
