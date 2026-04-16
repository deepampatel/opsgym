#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "./lib/workspace.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const maxIterations = Number(args["max-iterations"] || args.iterations || 5);
  const nextArgs = [];
  if (args.config) nextArgs.push("--config", args.config);
  if (args.yes) nextArgs.push("--yes");

  for (let i = 1; i <= maxIterations; i += 1) {
    console.log(`=== BanditDex iteration ${i}/${maxIterations} ===`);
    const result = spawnSync(process.execPath, [resolve(SCRIPT_DIR, "next.mjs"), ...nextArgs], {
      encoding: "utf8"
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.status !== 0) process.exit(result.status || 1);

    const output = `${result.stdout || ""}\n${result.stderr || ""}`;
    if (output.includes("Confirmation required")) {
      console.log("Loop paused at human confirmation gate.");
      return;
    }
    if (output.includes("Workspace complete.")) {
      console.log("Loop complete.");
      return;
    }
  }

  console.log(`Max iterations (${maxIterations}) reached.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
