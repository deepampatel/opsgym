#!/usr/bin/env node
import { clampInteger, readAgentPlansFile, validateAgentPlans } from "./lib/agents.mjs";
import { parseArgs } from "./lib/workspace.mjs";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const file = args.file || args["agents-file"];
  if (!file) throw new Error("Usage: validate-agent-plans --file <agents.json>");

  const count = clampInteger(args.agents || 6, 1, 6);
  const strict = args.strict !== false && args.strict !== "false";
  const plans = await readAgentPlansFile(file, count);
  const result = validateAgentPlans(plans, { strict });

  for (const warning of result.warnings) console.warn(`warn ${warning}`);
  if (!result.ok) {
    for (const error of result.errors) console.error(`fail ${error}`);
    process.exit(1);
  }

  console.log(`ok ${plans.length} agent plan${plans.length === 1 ? "" : "s"} valid`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
