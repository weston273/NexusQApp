import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const tailwindConfigPath = path.join(root, "tailwind.config.cjs");
const cssPath = path.join(root, "src", "index.css");
const ALLOWED_RUNTIME_VARS = new Set(["--radix-accordion-content-height"]);

function readOrThrow(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, "utf8");
}

function collectTailwindVars(content) {
  const out = new Set();
  const regex = /var\(--([a-z0-9-]+)\)/gi;
  let match = regex.exec(content);
  while (match) {
    out.add(`--${match[1]}`);
    match = regex.exec(content);
  }
  return out;
}

function collectDefinedCssVars(content) {
  const out = new Set();
  const regex = /(--[a-z0-9-]+)\s*:/gi;
  let match = regex.exec(content);
  while (match) {
    out.add(match[1]);
    match = regex.exec(content);
  }
  return out;
}

try {
  const tailwindConfig = readOrThrow(tailwindConfigPath);
  const css = readOrThrow(cssPath);

  const referenced = collectTailwindVars(tailwindConfig);
  const defined = collectDefinedCssVars(css);

  const missing = [...referenced]
    .filter((name) => !defined.has(name) && !ALLOWED_RUNTIME_VARS.has(name))
    .sort();
  if (missing.length) {
    console.error("Undefined CSS variables found in tailwind.config.cjs:");
    for (const variableName of missing) {
      console.error(`  ${variableName}`);
    }
    process.exit(1);
  }

  console.log("All CSS variables in tailwind.config.cjs are defined.");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
