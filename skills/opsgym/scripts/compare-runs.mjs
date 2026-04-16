#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createComparisonContract } from "./lib/contracts.mjs";
import { appendProgress, configPathFromArgs, readProjectConfigMaybe } from "./lib/config.mjs";
import { parseArgs, slug } from "./lib/workspace.mjs";

function formatMetric(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  const number = Number(value);
  if (Math.abs(number) < 1 && number !== 0) return `${Math.round(number * 100)}%`;
  return number.toLocaleString("en-IN");
}

function metricDeltas(baselineWinner, candidateWinner) {
  const baselineMetrics = baselineWinner?.averages || {};
  const candidateMetrics = candidateWinner?.averages || {};
  const metricIds = [...new Set([
    ...Object.keys(baselineMetrics),
    ...Object.keys(candidateMetrics)
  ])];

  return Object.fromEntries(metricIds.map((metric) => {
    const baseline = baselineMetrics[metric] ?? null;
    const candidate = candidateMetrics[metric] ?? null;
    const delta = baseline === null || candidate === null ? null : Number(candidate) - Number(baseline);
    return [metric, { baseline, candidate, delta }];
  }));
}

function choosePrimaryMetric(deltas) {
  if (deltas.opsScore) return "opsScore";
  if (deltas.trophyProbability) return "trophyProbability";
  return Object.keys(deltas)[0] || "score";
}

function summarize({ baselineRun, candidateRun, baselineRunId, candidateRunId }) {
  const baselineWinner = baselineRun.winner;
  const candidateWinner = candidateRun.winner;
  const deltas = metricDeltas(baselineWinner, candidateWinner);
  const primaryMetric = choosePrimaryMetric(deltas);
  const primaryDelta = deltas[primaryMetric]?.delta ?? null;
  const winnerChanged = baselineWinner?.policy !== candidateWinner?.policy;

  return {
    winnerChanged,
    baselineRunId,
    candidateRunId,
    baselinePolicy: baselineWinner?.policy || null,
    candidatePolicy: candidateWinner?.policy || null,
    baselinePolicyName: baselineWinner?.policyName || null,
    candidatePolicyName: candidateWinner?.policyName || null,
    primaryMetric,
    primaryDelta,
    metricDeltas: deltas,
    why: winnerChanged
      ? `Winning policy changed from ${baselineWinner?.policyName || "unknown"} to ${candidateWinner?.policyName || "unknown"}.`
      : `Winning policy stayed ${candidateWinner?.policyName || "unchanged"}; inspect metric deltas for scenario sensitivity.`
  };
}

function renderMarkdown(comparison) {
  const rows = Object.entries(comparison.summary.metricDeltas || {})
    .map(([metric, values]) => `| ${metric} | ${formatMetric(values.baseline)} | ${formatMetric(values.candidate)} | ${formatMetric(values.delta)} |`)
    .join("\n");

  return [
    `# OpsGym Comparison: ${comparison.comparisonId}`,
    "",
    `Arena: ${comparison.arenaId}`,
    `Baseline: ${comparison.baselineRunId}`,
    `Candidate: ${comparison.candidateRunId}`,
    "",
    `Baseline winner: ${comparison.summary.baselinePolicyName || "unknown"}`,
    `Candidate winner: ${comparison.summary.candidatePolicyName || "unknown"}`,
    `Winner changed: ${comparison.summary.winnerChanged ? "yes" : "no"}`,
    "",
    comparison.summary.why,
    "",
    "| Metric | Baseline | Candidate | Delta |",
    "|---|---:|---:|---:|",
    rows
  ].join("\n");
}

function renderHtml(comparison) {
  const rows = Object.entries(comparison.summary.metricDeltas || {})
    .map(([metric, values]) => `<tr><td>${metric}</td><td>${formatMetric(values.baseline)}</td><td>${formatMetric(values.candidate)}</td><td>${formatMetric(values.delta)}</td></tr>`)
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OpsGym Comparison - ${comparison.comparisonId}</title>
  <style>
    :root { color-scheme: light; --ink: #17211f; --muted: #63706d; --line: #dbe4df; --paper: #f7faf8; --white: #ffffff; --accent: #0f766e; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: var(--paper); color: var(--ink); }
    main { width: min(980px, calc(100% - 32px)); margin: 0 auto; padding: 32px 0 48px; }
    header { border-bottom: 1px solid var(--line); padding-bottom: 20px; }
    h1 { font-size: clamp(30px, 5vw, 54px); line-height: 1; margin: 0 0 12px; }
    p { color: var(--muted); line-height: 1.55; margin: 0; }
    .result { margin-top: 24px; border-left: 5px solid var(--accent); background: var(--white); border-radius: 8px; padding: 18px; }
    table { width: 100%; margin-top: 24px; border-collapse: collapse; background: var(--white); border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
    th, td { padding: 13px 12px; text-align: left; border-bottom: 1px solid var(--line); }
    th { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0; background: #edf5f2; }
  </style>
</head>
<body>
  <main>
    <header>
      <p>OpsGym / ${comparison.arenaId}</p>
      <h1>${comparison.comparisonId}</h1>
      <p>${comparison.baselineRunId} vs ${comparison.candidateRunId}</p>
    </header>
    <section class="result">
      <p>Baseline winner: <strong>${comparison.summary.baselinePolicyName || "unknown"}</strong></p>
      <p>Candidate winner: <strong>${comparison.summary.candidatePolicyName || "unknown"}</strong></p>
      <p>${comparison.summary.why}</p>
    </section>
    <table>
      <thead><tr><th>Metric</th><th>Baseline</th><th>Candidate</th><th>Delta</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </main>
</body>
</html>`;
}

async function readRun(workspace, runId) {
  const path = resolve(workspace, "runs", runId, "run.json");
  return {
    path,
    run: JSON.parse(await readFile(path, "utf8"))
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const configPath = configPathFromArgs(args);
  const config = await readProjectConfigMaybe(configPath);
  const workspace = args.workspace || config?.workspace || ".ops-gym";
  const baselineRunId = args.baseline || args.base || config?.runId;
  const candidateRunId = args.candidate || args.run;

  if (!baselineRunId || !candidateRunId) {
    throw new Error("Usage: opsgym compare --baseline <run-id> --candidate <run-id> [--comparison <id>]");
  }

  const comparisonId = args.comparison || slug(`${baselineRunId}-vs-${candidateRunId}`);
  const [{ run: baselineRun }, { run: candidateRun }] = await Promise.all([
    readRun(workspace, baselineRunId),
    readRun(workspace, candidateRunId)
  ]);

  const summary = summarize({ baselineRun, candidateRun, baselineRunId, candidateRunId });
  const comparison = createComparisonContract({
    comparisonId,
    arenaId: candidateRun.arenaId || baselineRun.arenaId,
    adapter: candidateRun.adapter || baselineRun.adapter,
    baselineRunId,
    candidateRunId,
    baselineWinner: baselineRun.winner,
    candidateWinner: candidateRun.winner,
    summary
  });

  const comparisonDir = resolve(workspace, "comparisons", comparisonId);
  const reportDir = resolve(workspace, "reports");
  await mkdir(comparisonDir, { recursive: true });
  await mkdir(reportDir, { recursive: true });

  const comparisonJson = resolve(comparisonDir, "comparison.json");
  const comparisonMd = resolve(comparisonDir, "comparison.md");
  const comparisonHtml = resolve(reportDir, `${comparisonId}.html`);
  await writeFile(comparisonJson, `${JSON.stringify(comparison, null, 2)}\n`);
  await writeFile(comparisonMd, `${renderMarkdown(comparison)}\n`);
  await writeFile(comparisonHtml, renderHtml(comparison));

  if (config) {
    await appendProgress(config, `compared ${baselineRunId} vs ${candidateRunId}`);
  }

  console.log(`Comparison: ${comparisonJson}`);
  console.log(`Memo: ${comparisonMd}`);
  console.log(`Report: ${comparisonHtml}`);
  console.log(`Winner changed: ${summary.winnerChanged ? "yes" : "no"}`);
  console.log(summary.why);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
