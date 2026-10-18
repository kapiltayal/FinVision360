import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
const installed = require("xlsx");
const sheetjsEntries = Object.entries(lock.packages).filter(([path]) =>
  /(?:^|\/)node_modules\/xlsx$/.test(path),
) as [string, { version: string; resolved: string; integrity: string }][];

function atLeast(version: string, floor: string): boolean {
  assert.match(version, /^\d+\.\d+\.\d+$/, "review non-release SheetJS versions explicitly");
  const actual = version.split(".").map(Number);
  const minimum = floor.split(".").map(Number);
  for (let index = 0; index < 3; index++) {
    if (actual[index] !== minimum[index]) return actual[index] > minimum[index];
  }
  return true;
}

test("every locked SheetJS copy is outside both reported advisory ranges", () => {
  assert.ok(sheetjsEntries.length > 0, "the spreadsheet parser must be in the lockfile");
  for (const [path, entry] of sheetjsEntries) {
    assert.ok(atLeast(entry.version, "0.19.3"), `${path}: GHSA-4r6h-8v6p-xvw6`);
    assert.ok(atLeast(entry.version, "0.20.2"), `${path}: GHSA-5pgg-2g8v-p4x9`);
  }
});

test("runtime and manifest use the integrity-pinned vendor build, not the outdated npm release", () => {
  const entry = lock.packages["node_modules/xlsx"];
  const vendorUrl = `https://cdn.sheetjs.com/xlsx-${entry.version}/xlsx-${entry.version}.tgz`;
  assert.equal(installed.version, entry.version);
  assert.equal(manifest.dependencies.xlsx, vendorUrl);
  assert.equal(lock.packages[""].dependencies.xlsx, vendorUrl);
  for (const [, locked] of sheetjsEntries) {
    assert.equal(locked.resolved, `https://cdn.sheetjs.com/xlsx-${locked.version}/xlsx-${locked.version}.tgz`);
    assert.match(locked.integrity, /^sha512-[A-Za-z0-9+/]{86}==$/);
  }
});
