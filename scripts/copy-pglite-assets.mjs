import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();

const sourceDir = join(
  root,
  "node_modules",
  "@electric-sql",
  "pglite",
  "dist",
);

const targetDir = join(
  root,
  ".vercel",
  "output",
  "functions",
  "__server.func",
  "_libs",
);

const files = [
  "pglite.data",
  "pglite.wasm",
  "initdb.wasm",
];

mkdirSync(targetDir, { recursive: true });

for (const file of files) {
  const source = join(sourceDir, file);
  const target = join(targetDir, file);

  if (!existsSync(source)) {
    throw new Error(`[pglite-assets] Missing source file: ${source}`);
  }

  copyFileSync(source, target);
  console.log(`[pglite-assets] copied ${file}`);
}

console.log(`[pglite-assets] target: ${targetDir}`);
