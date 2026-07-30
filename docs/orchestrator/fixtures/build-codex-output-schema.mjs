import { readFile, writeFile } from "node:fs/promises";

const [sourcePath, outputPath] = process.argv.slice(2);

if (!sourcePath || !outputPath) {
  throw new Error(
    "Usage: node build-codex-output-schema.mjs <source-schema> <output-schema>",
  );
}

const unsupportedKeywords = new Set(["format", "uniqueItems"]);

function toCodexOutputSchema(value) {
  if (Array.isArray(value)) {
    return value.map(toCodexOutputSchema);
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  const result = {};

  for (const [key, child] of Object.entries(value)) {
    if (unsupportedKeywords.has(key)) {
      continue;
    }

    result[key === "oneOf" ? "anyOf" : key] = toCodexOutputSchema(child);
  }

  if ("const" in result && !("type" in result)) {
    result.type = typeof result.const;
  }

  if (result.type === "object" && result.properties) {
    result.required = Object.keys(result.properties);
  }

  return result;
}

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const compatible = toCodexOutputSchema(source);

await writeFile(outputPath, `${JSON.stringify(compatible, null, 2)}\n`, "utf8");
