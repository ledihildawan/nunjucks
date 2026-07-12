export const createCompatInstaller = () => {
  let installed = false;
  return () => {
    if (installed) {
      return () => {};
    }
    installed = true;

    if (typeof window !== 'undefined') {
      const origInstall = window.__jinjaCompatInstall;
      if (origInstall) {
        return origInstall();
      }
    }

    return () => {
      installed = false;
    };
  };
};

let _defaultInstaller;
export const getDefaultInstaller = () => {
  if (!_defaultInstaller) {
    _defaultInstaller = createCompatInstaller();
  }
  return _defaultInstaller;
};
export default getDefaultInstaller;
