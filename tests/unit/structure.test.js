// Keeps the no-build module layout honest: every import names something the target module exports,
// and the service worker caches every app file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const modules = walk(join(ROOT, "src")).filter((f) => f.endsWith(".js"));

const exportsOf = (file) => {
  const src = readFileSync(file, "utf8"); const names = new Set();
  for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:function|const|let)\s+([\w$]+)/gm)) names.add(m[1]);
  for (const m of src.matchAll(/^export\s+const\s*\{([^}]+)\}/gm)) m[1].split(",").forEach((n) => names.add(n.trim()));
  return names;
};

test("every named import exists in the imported module", () => {
  for (const file of modules) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/^import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/gm)) {
      const target = join(dirname(file), m[2]); const have = exportsOf(target);
      for (const name of m[1].split(",").map((n) => n.trim())) assert.ok(have.has(name), `${relative(ROOT, file)}: "${name}" not exported by ${m[2]}`);
    }
  }
});

test("service worker caches every app file", () => {
  const sw = readFileSync(join(ROOT, "sw.js"), "utf8");
  for (const file of modules) assert.ok(sw.includes(`"./${relative(ROOT, file)}"`), `sw.js SHELL is missing ./${relative(ROOT, file)}`);
  assert.ok(sw.includes('"./styles.css"'));
});
