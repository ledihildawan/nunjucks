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
