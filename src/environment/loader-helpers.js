export const isRelativePath = (loader, filename) =>
  (loader.isRelative && filename) ? loader.isRelative(filename) : false;

export const resolveTemplatePath = (loader, parentName, filename) =>
  isRelativePath(loader, filename) && loader.resolve
    ? loader.resolve(parentName, filename)
    : filename;
