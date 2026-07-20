await Bun.build({
  entrypoints: ["./src/index.js"],
  outdir: "./dist",
  format: "esm",
  splitting: false,
  minify: false,
  sourcemap: "linked",
  target: "bun",
});

console.log("Build complete!");
