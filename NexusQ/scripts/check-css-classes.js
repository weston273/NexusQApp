import fs from "node:fs";
import path from "node:path";

const sourceRoot = path.join(process.cwd(), "src");
const suspiciousMarkers = ["â", "Â", "\uFFFD"];
const allowedExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".css", ".md"]);

function walk(dirPath, fileList = []) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, fileList);
      continue;
    }
    if (allowedExtensions.has(path.extname(entry.name).toLowerCase())) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function hasSuspiciousEncoding(content) {
  return suspiciousMarkers.some((marker) => content.includes(marker));
}

try {
  if (!fs.existsSync(sourceRoot)) {
    throw new Error(`Source folder not found: ${sourceRoot}`);
  }

  const files = walk(sourceRoot);
  const flagged = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, "utf8");
    if (hasSuspiciousEncoding(content)) {
      flagged.push(path.relative(process.cwd(), filePath));
    }
  }

  if (flagged.length) {
    console.error("Potential mojibake/encoding artifacts found:");
    for (const relPath of flagged) {
      console.error(`  ${relPath}`);
    }
    process.exit(1);
  }

  console.log("No suspicious encoding artifacts detected in src.");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
