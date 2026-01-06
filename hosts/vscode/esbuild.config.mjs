import * as esbuild from "esbuild";

const production = process.argv.includes("production");
const watch = process.argv.includes("--watch");

const banner = `/*
 * vscode-agentlet - Agentlet host for VS Code
 * This is a bundled file. See source at: https://github.com/Agentlet-org/agentlet
 */`;

/** @type {esbuild.BuildOptions} */
const buildOptions = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  target: "node18",
  sourcemap: !production,
  minify: production,
  banner: { js: banner },
  logLevel: "info",
};

async function main() {
  if (watch) {
    const context = await esbuild.context(buildOptions);
    await context.watch();
    console.log("Watching for changes...");
  } else {
    await esbuild.build(buildOptions);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
