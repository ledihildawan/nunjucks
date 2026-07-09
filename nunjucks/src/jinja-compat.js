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

const defaultInstaller = createCompatInstaller();
export default defaultInstaller;
