import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { stdio: "inherit", env: { ...process.env, NODE_PATH: join(process.cwd(), "node_modules") } });
  if (result.status !== 0) throw new Error(`Goal allocation verification failed: ${command}`);
}
const dir = mkdtempSync(join(tmpdir(), "goal-allocation-"));
try {
  run("npx", ["tsx", "--test", "server/goal-allocation.test.ts", "server/goal-allocation.integration.test.ts", "server/goal-history.test.ts", "client/src/lib/goal-monthly-savings.test.ts"]);
  const output = join(dir, "ui.cjs");
  run("npx", ["esbuild", "client/src/components/goal-allocation-tab.test.tsx", "--bundle", "--platform=node", "--format=cjs", "--jsx=automatic", '--define:import.meta.env.MODE="development"', "--external:react", "--external:react-dom/*", `--outfile=${output}`]);
  run(process.execPath, ["-e", 'globalThis.WebSocket=require("ws");require(process.argv[1])', output]);
} finally { rmSync(dir, { recursive: true, force: true }); }
