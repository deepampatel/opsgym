#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { adapterRefFromArena, loadAdapter } from "./lib/adapter-loader.mjs";
import {
  AGENT_SCHEMA,
  PARAMETER_DESCRIPTIONS,
  clampInteger,
  environmentBrief,
  assertValidAgentPlans,
  normalizePlans,
  readAgentPlansFile,
  toPolicyMap
} from "./lib/agents.mjs";
import { createRunContract } from "./lib/contracts.mjs";
import { appendProgress, configPathFromArgs, readProjectConfigMaybe } from "./lib/config.mjs";
import { loadEnvironment, parseArgs } from "./lib/workspace.mjs";

function responseText(payload) {
  if (payload.output_text) return payload.output_text;
  const parts = [];
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) parts.push(content.text);
      if (content.type === "text" && content.text) parts.push(content.text);
    }
  }
  return parts.join("\n");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function offlinePlans(count) {
  const plans = [
    {
      id: "agent-resilience-first",
      name: "Agent: Resilience first",
      thesis: "Protect service during shocks with strong fallback recovery and high-priority capacity focus.",
      parameters: { capacityAggression: 0.64, riskTolerance: 0.58, executionAggression: 1.02, fallbackRecovery: 0.96, priorityFocus: 0.94 }
    },
    {
      id: "agent-cash-guardian",
      name: "Agent: Risk guardian",
      thesis: "Preserve scarce capacity and accept some missed throughput to avoid downside risk.",
      parameters: { capacityAggression: 0.34, riskTolerance: 0.3, executionAggression: 0.78, fallbackRecovery: 0.35, priorityFocus: 0.58 }
    },
    {
      id: "agent-growth-push",
      name: "Agent: Performance push",
      thesis: "Push execution aggressively, relying on high throughput to offset risk and operating cost.",
      parameters: { capacityAggression: 0.92, riskTolerance: 0.78, executionAggression: 1.1, fallbackRecovery: 0.62, priorityFocus: 0.52 }
    }
  ];
  return plans.slice(0, count);
}

async function callOpenAI({ model, environment, count }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for real LLM agents. Use --offline only for smoke tests.");

  const prompt = [
    "Create LLM decision agents for this OpsGym arena.",
    "Each agent should be meaningfully different and encoded as simulator parameters.",
    "Parameter meanings:",
    ...PARAMETER_DESCRIPTIONS.map(([name, description]) => `- ${name}: ${description}`),
    `Return exactly ${count} agents.`,
    "",
    JSON.stringify(environmentBrief(environment), null, 2)
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: "You design operational decision agents for simulation. Return only schema-valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "opsgym_agent_plans",
          strict: true,
          schema: AGENT_SCHEMA
        }
      }
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || `OpenAI API request failed with status ${response.status}`);
  }
  const text = responseText(payload);
  if (!text) throw new Error("OpenAI response did not contain output_text.");
  return JSON.parse(text).agents;
}

function compactRollouts(allRollouts) {
  return allRollouts.map((rollout) => ({
    policy: rollout.policy,
    policyName: rollout.policyName,
    rolloutIndex: rollout.rolloutIndex,
    metrics: rollout.metrics
  }));
}

function renderAgentMemo({ runId, model, source, agentPlans, scoreboard, wins, reportPath }) {
  const winner = scoreboard[0];
  return [
    `# OpsGym Agent Tournament: ${runId}`,
    "",
    `Agent source: ${source}`,
    `Model: ${model}`,
    "",
    `Winner: ${winner.policyName}`,
    `OpsScore: ${winner.averages.opsScore?.toLocaleString("en-IN")}`,
    `Rollout wins: ${wins[winner.policy] || 0}`,
    "",
    "Agents:",
    ...agentPlans.map((agent) => `- ${agent.name}: ${agent.description}`),
    "",
    "Leaderboard:",
    ...scoreboard.map((row, index) => `${index + 1}. ${row.policyName}: ${row.averages.opsScore?.toLocaleString("en-IN")} OpsScore`),
    "",
    `Report: ${reportPath}`
  ].join("\n");
}

function renderAgentReport({ runId, model, source, agentPlans, scoreboard, wins }) {
  const rows = scoreboard.map((row, index) => {
    const service = Number.isFinite(row.averages.serviceLevel) ? `${Math.round(row.averages.serviceLevel * 100)}%` : "-";
    return `<tr><td>${index + 1}</td><td><strong>${escapeHtml(row.policyName)}</strong><br><span>${escapeHtml(row.description)}</span></td><td>${row.averages.opsScore?.toLocaleString("en-IN")}</td><td>${service}</td><td>${wins[row.policy] || 0}</td></tr>`;
  }).join("");
  const agentCards = agentPlans.map((agent) => `<article><h3>${escapeHtml(agent.name)}</h3><p>${escapeHtml(agent.description)}</p><pre>${escapeHtml(JSON.stringify(agent.parameters, null, 2))}</pre></article>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OpsGym Agent Tournament - ${runId}</title>
  <style>
    :root { color-scheme: light; --ink: #17211f; --muted: #63706d; --line: #dbe4df; --paper: #f7faf8; --white: #ffffff; --accent: #0f766e; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: var(--paper); color: var(--ink); }
    main { width: min(1080px, calc(100% - 32px)); margin: 0 auto; padding: 32px 0 48px; }
    header { border-bottom: 1px solid var(--line); padding-bottom: 20px; }
    h1 { font-size: clamp(30px, 5vw, 54px); line-height: 1; margin: 0 0 12px; }
    p { color: var(--muted); line-height: 1.55; margin: 0; }
    section { margin-top: 26px; }
    table { width: 100%; border-collapse: collapse; background: var(--white); border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
    th, td { padding: 13px 12px; text-align: left; border-bottom: 1px solid var(--line); vertical-align: top; }
    th { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0; background: #edf5f2; }
    td span { color: var(--muted); font-size: 13px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    article { background: var(--white); border: 1px solid var(--line); border-radius: 8px; padding: 14px; }
    h3 { margin: 0 0 8px; }
    pre { overflow: auto; background: #edf5f2; border-radius: 8px; padding: 10px; }
    @media (max-width: 860px) { .grid { grid-template-columns: 1fr; } table { display: block; overflow-x: auto; } }
  </style>
</head>
<body>
  <main>
    <header>
      <p>OpsGym Agent Tournament / ${escapeHtml(source)} / ${escapeHtml(model)}</p>
      <h1>${escapeHtml(runId)}</h1>
      <p>LLM-designed decision agents evaluated through repeated simulation rollouts.</p>
    </header>
    <section>
      <h2>Leaderboard</h2>
      <table><thead><tr><th>Rank</th><th>Agent</th><th>OpsScore</th><th>Service</th><th>Wins</th></tr></thead><tbody>${rows}</tbody></table>
    </section>
    <section>
      <h2>Agent Plans</h2>
      <div class="grid">${agentCards}</div>
    </section>
  </main>
</body>
</html>`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const configPath = configPathFromArgs(args);
  const config = await readProjectConfigMaybe(configPath);
  const arena = args.arena || config?.arenaId || "footballops-v0";
  const workspace = args.workspace || config?.workspace || ".ops-gym";
  const runId = args.run || `${config?.project || "agent"}-agents`;
  const rollouts = clampInteger(args.rollouts || config?.rollouts || 50, 1, 10000);
  const seed = args.seed || `${runId}-seed`;
  const model = args.model || process.env.OPSGYM_AGENT_MODEL || (args["agents-file"] ? "codex" : "gpt-4.1-mini");
  const agentCount = clampInteger(args.agents || 3, 1, 6);
  const source = args["agents-file"] ? "codex-file" : (args.offline ? "offline-fixture" : "openai");

  const envPath = resolve(workspace, "environments", arena, "environment.json");
  const environment = await loadEnvironment(workspace, arena);
  const adapter = await loadAdapter(adapterRefFromArena({ arenaId: arena, adapter: environment.adapter }));

  const rawPlans = args["agents-file"]
    ? await readAgentPlansFile(args["agents-file"], agentCount)
    : args.offline
      ? offlinePlans(agentCount)
      : await callOpenAI({ model, environment, count: agentCount });
  assertValidAgentPlans(rawPlans, { strict: Boolean(args["agents-file"]) });
  const agentPlans = normalizePlans(rawPlans, source, model);
  const policies = toPolicyMap(agentPlans);

  const allRollouts = [];
  for (let i = 0; i < rollouts; i += 1) {
    for (const [policyKey, policyConfig] of Object.entries(policies)) {
      allRollouts.push(adapter.runPolicy({
        environment,
        policyKey,
        policyConfig,
        rolloutIndex: i,
        seed
      }));
    }
  }

  const { scoreboard, wins } = adapter.summarizeScoreboard({ allRollouts, policies, environment });

  const runDir = resolve(workspace, "runs", runId);
  const reportDir = resolve(workspace, "reports");
  const reportPath = resolve(reportDir, `${runId}.html`);
  await mkdir(runDir, { recursive: true });
  await mkdir(reportDir, { recursive: true });

  const runContract = createRunContract({
    arenaId: arena,
    adapter: environment.adapter ?? { id: arena, type: "arena-adapter" },
    question: environment.question,
    runId,
    rollouts,
    seed,
    workspace,
    environmentPath: envPath,
    scoreboard,
    wins,
    reportPath
  });
  runContract.mode = "agent-tournament";
  runContract.agentSource = source;
  runContract.agentModel = model;
  runContract.agentPlans = agentPlans;

  await writeFile(resolve(runDir, "run.json"), `${JSON.stringify(runContract, null, 2)}\n`);
  await writeFile(resolve(runDir, "agents.json"), `${JSON.stringify({ source, model, agents: agentPlans }, null, 2)}\n`);
  await writeFile(resolve(runDir, "rollouts.json"), `${JSON.stringify(compactRollouts(allRollouts), null, 2)}\n`);
  await writeFile(resolve(runDir, "scores.json"), `${JSON.stringify({ runId, arena, mode: "agent-tournament", scoreboard, wins }, null, 2)}\n`);
  await writeFile(resolve(runDir, "decision-memo.md"), `${renderAgentMemo({ runId, model, source, agentPlans, scoreboard, wins, reportPath })}\n`);
  await writeFile(reportPath, renderAgentReport({ runId, model, source, agentPlans, scoreboard, wins }));

  if (config) await appendProgress(config, `ran LLM agent tournament ${runId} with ${rollouts} rollouts`);

  const winner = scoreboard[0];
  console.log(`Winner: ${winner.policyName} (${winner.averages.opsScore.toLocaleString("en-IN")} OpsScore)`);
  console.log(`Agent source: ${source}`);
  console.log(`Report: ${reportPath}`);
  console.log(`Run directory: ${runDir}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
