// WHY: entrypoints are resolved from each package's own package.json (main, then
// exports) instead of a hardcoded list — a new package becomes bundleable the moment
// it declares a public entry, with zero script churn.
// WHY: glob targets package.json files (not directories) because Bun's glob on
// Windows does not match directory entries with `*`; separators are normalised
// because scanSync returns backslashes on Windows.
const packageManifests = [...new Bun.Glob('*/package.json').scanSync('packages/@nunjucks')]
  .map((found) => found.replaceAll('\\', '/'))
  .sort();

// WHY: entrypoints are the DEDUPED UNION of `main` and every string `exports` target —
// a package with a barrel `main` still ships its subpath entries (e.g.
// @nunjucks/core/diagnostics, @nunjucks/filters/sanitize), and a main-less package
// (integrations) falls back to its exports map alone.
const resolveEntrypoints = (manifest) => {
  const exportTargets = Object.values(manifest.exports ?? {}).flatMap((target) => {
    if (typeof target === 'string') {
      return [target];
    }
    const defaultTarget = target?.default;
    return typeof defaultTarget === 'string' ? [defaultTarget] : [];
  });
  const mainTarget = typeof manifest.main === 'string' ? [manifest.main] : [];
  return [...new Set([...mainTarget, ...exportTargets])];
};

let failed = false;

const buildPackage = async (manifestPath) => {
  const packageDir = `packages/@nunjucks/${manifestPath.replace('/package.json', '')}`;
  const manifest = await Bun.file(`${packageDir}/package.json`).json();
  const entrypoints = resolveEntrypoints(manifest).map(
    (entry) => `${packageDir}/${entry.replace('./', '')}`
  );

  if (entrypoints.length === 0) {
    return { status: 'skip', name: manifest.name };
  }

  const result = await Bun.build({
    entrypoints,
    outdir: `./dist/${manifest.name.replace(/^@nunjucks\//, '')}`,
    format: 'esm',
    splitting: false,
    minify: false,
    sourcemap: 'linked',
    target: 'bun',
  });

  if (!result.success) {
    return { status: 'fail', name: manifest.name, logs: result.logs };
  }

  return { status: 'bundled', name: manifest.name, entries: entrypoints.length };
};

// WHY: each build targets a disjoint outdir and shares no state, so packages build
// concurrently; results are reported in sorted manifest order so output stays
// deterministic regardless of completion order.
const outcomes = await Promise.allSettled(packageManifests.map(buildPackage));

for (const outcome of outcomes) {
  if (outcome.status === 'rejected') {
    failed = true;
    console.error(outcome.reason);
    continue;
  }
  const build = outcome.value;
  if (build.status === 'skip') {
    console.warn(`skip ${build.name} — no public entrypoint declared`);
  } else if (build.status === 'fail') {
    failed = true;
    for (const log of build.logs) {
      console.error(log);
    }
  } else {
    console.log(
      `bundled ${build.name} (${build.entries} entr${build.entries === 1 ? 'y' : 'ies'})`
    );
  }
}

if (failed) {
  process.exit(1);
}

console.log('Build complete!');
