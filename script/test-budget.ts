import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function run(command: string, args: string[], extraEnv: Record<string, string> = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", env: { ...process.env, ...extraEnv } });
  if (result.status !== 0) throw new Error(`Budget verification failed: ${command} (exit ${result.status})`);
}

const dir = mkdtempSync(join(tmpdir(), "budget-tests-"));
try {
  run("npx", ["tsx", "--test", "server/budget-history.test.ts", "server/budget-history.integration.test.ts",
    "client/src/lib/budget-plan-amounts.test.ts", "client/src/lib/budget-plan-input.test.ts",
    "client/src/lib/goal-monthly-savings.test.ts"]);
  const compiled = join(dir, "ui.test.cjs");
  run("npx", ["esbuild", "client/src/pages/budgeting-plan.test.tsx", "--bundle", "--platform=node",
    "--format=cjs", "--jsx=automatic", '--define:import.meta.env.MODE="development"',
    "--external:react", "--external:react-dom/*", `--outfile=${compiled}`]);
  // Importing the synchronous browser Supabase singleton during SSR tests
  // requires a WebSocket constructor on the project's Node 20 runtime.
  run(process.execPath, ["-e", 'globalThis.WebSocket=require("ws");require(process.argv[1])', compiled],
    { NODE_PATH: join(process.cwd(), "node_modules") });
} finally {
  rmSync(dir, { recursive: true, force: true });
}
