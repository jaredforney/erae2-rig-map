// Build: bundle src -> dist/app.js, copy public/ -> dist/
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });
cpSync("public", "dist", { recursive: true });

await build({
  entryPoints: ["src/entry.jsx"],
  bundle: true,
  minify: true,
  loader: { ".jsx": "jsx" },
  define: { "process.env.NODE_ENV": '"production"' },
  outfile: "dist/app.js",
});

console.log("built -> dist/");
