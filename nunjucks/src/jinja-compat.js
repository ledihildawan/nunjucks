let installed = false;

export default function installCompat() {
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
}
