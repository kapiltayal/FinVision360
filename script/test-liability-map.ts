import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, {
    stdio: "inherit", env: { ...process.env, NODE_PATH: join(process.cwd(), "node_modules") },
  });
  if (result.status !== 0) throw new Error(`Liability Map verification failed: ${command}`);
}
const dir = mkdtempSync(join(tmpdir(), "liability-map-tests-"));
try {
  run("npx", ["tsx", "--test", "client/src/lib/liability-map.test.ts", "client/src/lib/liability-bubbles.test.ts"]);
  for (const [index, entry] of [
    "client/src/pages/liability-map.test.ts", "client/src/components/liability-bubble-chart.test.tsx",
  ].entries()) {
    const output = join(dir, `ui-${index}.cjs`);
    run("npx", ["esbuild", entry, "--bundle", "--platform=node", "--format=cjs", "--jsx=automatic",
      '--define:import.meta.env.MODE="development"', "--external:react", "--external:react-dom/*", `--outfile=${output}`]);
    run(process.execPath, ["-e", 'globalThis.WebSocket=require("ws");require(process.argv[1])', output]);
  }
} finally { rmSync(dir, { recursive: true, force: true }); }
