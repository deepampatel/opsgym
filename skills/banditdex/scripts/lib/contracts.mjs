import { resolve } from "node:path";

export const BANDITDEX_SCHEMA_VERSION = "0.2";

export function createAdapterDescriptor({
  id,
  version = "0.1",
  domain = "decision-ops",
  description = "Arena adapter"
}) {
  return {
    id,
    type: "arena-adapter",
    version,
    domain,
    description,
    entry: `arenas/${id}/adapter.mjs`
  };
}

export function createRunContract({
  arenaId,
  adapter,
  question,
  runId,
  rollouts,
  seed,
  workspace,
  environmentPath,
  scoreboard,
  wins,
  reportPath
}) {
  return {
    schemaVersion: BANDITDEX_SCHEMA_VERSION,
    type: "banditdex-run",
    runId,
    arenaId,
    adapter,
    question,
    rollouts,
    seed,
    createdAt: new Date().toISOString(),
    workspaceRoot: resolve(workspace),
    inputs: {
      environmentPath,
      reportPath
    },
    outputs: {
      runDir: resolve(workspace, "runs", runId),
      reportPath,
      scoresPath: resolve(workspace, "runs", runId, "scores.json"),
      rolloutsPath: resolve(workspace, "runs", runId, "rollouts.json"),
      tracePath: resolve(workspace, "runs", runId, "trace.md")
    },
    winner: scoreboard[0] ?? null,
    scoreboard,
    wins
  };
}

export function createComparisonContract({
  comparisonId,
  arenaId,
  adapter,
  baselineRunId,
  candidateRunId,
  baselineWinner,
  candidateWinner,
  summary
}) {
  return {
    schemaVersion: BANDITDEX_SCHEMA_VERSION,
    type: "banditdex-comparison",
    comparisonId,
    arenaId,
    adapter,
    createdAt: new Date().toISOString(),
    baselineRunId,
    candidateRunId,
    baselineWinner,
    candidateWinner,
    summary
  };
}
