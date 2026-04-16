import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { arenaPaths, readJson } from "./workspace.mjs";
import { fileExists, progressPath } from "./config.mjs";

async function readJsonMaybe(path) {
  if (!(await fileExists(path))) return null;
  return readJson(path);
}

async function readRuns(workspace) {
  const runsDir = resolve(workspace, "runs");
  if (!(await fileExists(runsDir))) return [];
  const entries = await readdir(runsDir, { withFileTypes: true });
  const runs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const runJson = resolve(runsDir, entry.name, "run.json");
    runs.push({
      id: entry.name,
      runJson,
      hasRunContract: await fileExists(runJson)
    });
  }
  return runs.sort((a, b) => a.id.localeCompare(b.id));
}

export async function workspaceState(config, options = {}) {
  const paths = arenaPaths(config.workspace, config.arenaId);
  const arena = await readJsonMaybe(paths.arenaJson);
  const environment = await readJsonMaybe(paths.envJson);
  const runId = config.runId || `${config.project}-baseline`;
  const runJson = resolve(config.workspace, "runs", runId, "run.json");
  const reportPath = resolve(config.workspace, "reports", `${runId}.html`);
  const runs = await readRuns(config.workspace);

  const status = {
    configPath: options.configPath || null,
    progressPath: progressPath(config),
    arenaId: config.arenaId,
    project: config.project,
    workspace: config.workspace,
    runId,
    paths,
    arenaExists: Boolean(arena),
    arenaStatus: arena?.status || "missing",
    environmentExists: Boolean(environment),
    runExists: await fileExists(runJson),
    reportExists: await fileExists(reportPath),
    runs,
    arena,
    environment
  };

  if (!status.arenaExists) {
    status.nextAction = "draft_arena";
  } else if (status.arenaStatus !== "confirmed") {
    status.nextAction = "confirm_arena";
  } else if (!status.environmentExists) {
    status.nextAction = "materialize_environment";
  } else if (!status.runExists) {
    status.nextAction = "run_tournament";
  } else if (!status.reportExists) {
    status.nextAction = "render_report";
  } else {
    status.nextAction = "complete";
  }

  return status;
}

export function describeNextAction(action) {
  return {
    draft_arena: "Draft the arena from banditdex.json.",
    confirm_arena: "Review the arena summary and confirm it.",
    materialize_environment: "Create the executable environment from the confirmed arena.",
    run_tournament: "Run the tournament and produce run artifacts.",
    render_report: "The report is missing; rerun the tournament for this run id.",
    complete: "Workspace has a confirmed arena, environment, run contract, and report."
  }[action] || "Unknown next action.";
}
