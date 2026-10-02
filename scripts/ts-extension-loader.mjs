import { access } from "node:fs/promises";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const EXTENSIONS = [".ts", ".tsx", ".js", ".mjs"];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function resolve(specifier, context, nextResolve) {
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !/\.(?:ts|tsx|js|jsx|mjs|cjs)(?:[?#].*)?$/i.test(specifier)
  ) {
    const parent = context.parentURL
      ? fileURLToPath(context.parentURL)
      : process.cwd();

    const base = resolvePath(dirname(parent), specifier);

    for (const ext of EXTENSIONS) {
      const candidate = `${base}${ext}`;
      if (await exists(candidate)) {
        return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
  }

  return nextResolve(specifier, context);
}
