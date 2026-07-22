import { createFileSystemLoader } from '../loaders/index.js';

let cachedLoader = null;
let cachedViewsPath = null;

export const getLoader = (config) => {
  const viewsPath = config.views || config.root;
  if (!viewsPath) return null;

  if (cachedLoader && cachedViewsPath === viewsPath) {
    return cachedLoader;
  }

  cachedLoader = createFileSystemLoader(viewsPath, { noCache: config.dev || false });
  cachedViewsPath = viewsPath;
  return cachedLoader;
};

export const createEngine = (config = {}) => {
  let engineCachedLoader = null;
  let engineCachedViewsPath = null;

  return {
    getLoader: (cfg) => {
      const viewsPath = cfg.views || cfg.root;
      if (!viewsPath) return null;

      if (engineCachedLoader && engineCachedViewsPath === viewsPath) {
        return engineCachedLoader;
      }

      engineCachedLoader = createFileSystemLoader(viewsPath, { noCache: cfg.dev || false });
      engineCachedViewsPath = viewsPath;
      return engineCachedLoader;
    }
  };
};
