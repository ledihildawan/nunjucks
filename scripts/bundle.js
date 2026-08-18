// WHY: entrypoints are resolved from each package's own package.json (main, then
// exports) instead of a hardcoded list — a new package becomes bundleable the moment
// it declares a public entry, with zero script churn.
// WHY: glob targets package.json files (not directories) because Bun's glob on
// Windows does not match directory entries with `*`; separators are normalised
// because scanSync returns backslashes on Windows.
const packageManifests = [...new Bun.Glob('*/package.json').scanSync('packages/@nunjucks')]
  .map((found) => found.replaceAll('\\', '/'))
  .sort();

const resolveEntrypoints = (manifest) => {
  if (typeof manifest.main === 'string') {
    return [manifest.main];
  }
  // WHY: exports maps subpaths (e.g. @nunjucks/integrations/express) — only string
  // targets are bundleable; conditional objects fall back to their "default" branch.
  return Object.values(manifest.exports ?? {}).flatMap((target) => {
    if (typeof target === 'string') {
      return [target];
    }
    const defaultTarget = target?.default;
    return typeof defaultTarget === 'string' ? [defaultTarget] : [];
  });
};

let failed = false;

for (const manifestPath of packageManifests) {
  const packageDir = `packages/@nunjucks/${manifestPath.replace('/package.json', '')}`;
  const manifest = await Bun.file(`${packageDir}/package.json`).json();
  const entrypoints = resolveEntrypoints(manifest).map(
    (entry) => `${packageDir}/${entry.replace('./', '')}`
  );

  if (entrypoints.length === 0) {
    console.warn(`skip ${manifest.name} — no public entrypoint declared`);
    continue;
  }

  const result = await Bun.build({
    entrypoints,
    outdir: `./dist/${manifest.name.replace('@nunjucks/', '')}`,
    format: 'esm',
    splitting: false,
    minify: false,
    sourcemap: 'linked',
    target: 'bun',
  });

  if (!result.success) {
    failed = true;
    for (const log of result.logs) {
      console.error(log);
    }
    continue;
  }

  console.log(
    `bundled ${manifest.name} (${entrypoints.length} entr${entrypoints.length === 1 ? 'y' : 'ies'})`
  );
}

if (failed) {
  process.exit(1);
}

console.log('Build complete!');
