const result = await Bun.build({
  entrypoints: ["./src/index.js"],
  outdir: "./dist",
  format: "esm",
  splitting: false,
  minify: false,
  sourcemap: "linked",
  target: "bun",
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

console.log("Build complete!");
