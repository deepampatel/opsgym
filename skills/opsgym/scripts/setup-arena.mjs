#!/usr/bin/env node
import { loadAdapter } from "./lib/adapter-loader.mjs";
import { parseArgs, splitList, writeArenaArtifacts } from "./lib/workspace.mjs";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const arenaId = args.arena || "footballops-v0";
  const workspace = args.workspace || ".ops-gym";
  const question = args.question || "Should the club rotate heavily or push starters through fixture congestion?";
  const setupMode = args.mode || "fast";

  const adapter = await loadAdapter(arenaId);
  const arenaSpec = await adapter.buildDraftArena({
    arenaId,
    inputDir: args["input-dir"],
    question,
    days: Number(args.days || 7),
    setupMode,
    actionIds: splitList(args.actions),
    constraintIds: splitList(args.constraints),
    shockTypes: splitList(args.shocks),
    metricIds: splitList(args.metrics),
    policyIds: splitList(args.policies)
  });

  if (args.confirm) {
    arenaSpec.status = "confirmed";
    arenaSpec.confirmedAt = new Date().toISOString();
  }

  const paths = await writeArenaArtifacts(workspace, arenaSpec);
  console.log(`Created arena draft: ${paths.arenaJson}`);
  console.log(`Summary: ${paths.arenaSummary}`);
  console.log(`Status: ${arenaSpec.status}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
