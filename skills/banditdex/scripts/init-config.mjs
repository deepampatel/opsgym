#!/usr/bin/env node
import { configPathFromArgs, ensureProgress, normalizeConfig, writeProjectConfig } from "./lib/config.mjs";
import { parseArgs } from "./lib/workspace.mjs";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const configPath = configPathFromArgs(args);
  const config = normalizeConfig({
    project: args.project,
    arenaId: args.arena,
    domain: args.domain,
    question: args.question,
    workspace: args.workspace,
    setupMode: args["setup-mode"] || args.mode,
    runId: args.run,
    rollouts: args.rollouts,
    seed: args.seed,
    mode: args.auto ? "auto" : "guided",
    maxIterations: args["max-iterations"]
  });

  await writeProjectConfig(config, configPath);
  const progress = await ensureProgress(config);

  console.log(`Created BanditDex config: ${configPath}`);
  console.log(`Progress log: ${progress}`);
  console.log(`Arena: ${config.arenaId}`);
  console.log(`Project: ${config.project}`);
  console.log(`Next: ./banditdex next`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
