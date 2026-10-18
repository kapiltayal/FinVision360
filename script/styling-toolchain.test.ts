import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { compile } from "tailwindcss";
import { twMerge } from "tailwind-merge";

function atLeast(version: string, minimum: string): boolean {
  const actual = version.split(".").map(Number);
  const floor = minimum.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (actual[i] !== floor[i]) return actual[i] > floor[i];
  }
  return true;
}

test("the styling dependency tree excludes unpatched glob parsers and keeps security fixes", () => {
  const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
  const floors: Record<string, string> = {
    "proxy-addr": "2.0.8",
    axios: "1.20.0",
    "source-map-js": "1.2.2",
    undici: "7.29.1",
    multer: "2.4.0",
    dompurify: "3.4.16",
    "postcss-selector-parser": "7.1.6",
    tailwindcss: "4.0.0",
  };
  const seen = new Set<string>();
  for (const [location, pkg] of Object.entries(lock.packages) as [string, { version?: string }][]) {
    const name = location.split("node_modules/").pop()!;
    assert.notEqual(name, "braces", "unpatched braces must not return");
    assert.notEqual(name, "brace-expansion", "the legacy glob dependency tree must not return");
    if (!floors[name]) continue;
    const minimum = name === "undici" && pkg.version?.startsWith("8.") ? "8.10.2" : floors[name];
    assert.ok(pkg.version && atLeast(pkg.version, minimum), `${name}@${pkg.version} is below ${minimum}`);
    seen.add(name);
  }
  // undici belonged only to the retired scraper. Check its floor if it
  // returns transitively, but never require installing it for this test.
  for (const name of Object.keys(floors).filter((name) => name !== "undici")) {
    assert.ok(seen.has(name), `missing checked dependency ${name}`);
  }
  assert.ok(!lock.packages["node_modules/cheerio"], "the retired scraper dependency must not return");
});

test("legacy design utilities retain colors, shadows, blur and accessible focus outlines", async () => {
  const compat = readFileSync("client/src/styles/tailwind-compat.css", "utf8");
  const compiler = await compile(`${compat}\n@tailwind utilities;`);
  const css = compiler.build(["bg-blue-500", "shadow-sm", "blur-sm", "outline-none", "focus-visible:outline-none"]);
  assert.match(css, /background-color:\s*#3b82f6/);
  assert.match(css, /0 1px 2px 0/);
  assert.match(css, /blur\(4px\)/);
  assert.match(css, /outline:\s*2px solid transparent/);
  assert.match(css, /outline-offset:\s*2px/);
  assert.match(css, /@media\s*\(forced-colors:\s*active\)/);
  assert.match(css, /outline:\s*2px solid transparent\s*!important/, "forced-colors outline must outrank the built-in reset");
  assert.ok(css.includes("focus-visible\\:outline-none"), "focus variants must still compile");
});

test("class merging understands Tailwind 4 CSS-variable utilities used by menus and charts", () => {
  assert.equal(twMerge("p-4 p-2"), "p-2");
  assert.equal(twMerge("bg-primary bg-(--color-bg)"), "bg-(--color-bg)");
  assert.equal(twMerge("max-h-96 max-h-(--radix-select-content-available-height)"), "max-h-(--radix-select-content-available-height)");
  assert.equal(twMerge("rounded-sm rounded-md"), "rounded-md");
});
