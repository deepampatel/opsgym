import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

export function slug(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function splitList(value, fallback = []) {
  if (!value) return fallback;
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function readMaybe(path, fallback = "") {
  try {
    return await readFile(path, "utf8");
  } catch {
    return fallback;
  }
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function arenaPaths(workspace, arenaId) {
  const arenaDir = resolve(workspace, "arenas", arenaId);
  const envDir = resolve(workspace, "environments", arenaId);
  return {
    arenaDir,
    arenaJson: resolve(arenaDir, "arena.json"),
    arenaSummary: resolve(arenaDir, "arena-summary.md"),
    envDir,
    envJson: resolve(envDir, "environment.json"),
    envSummary: resolve(envDir, "create-summary.md")
  };
}

function section(title, items, renderItem) {
  if (!items?.length) return [];
  return [title, ...items.map(renderItem), ""];
}

export function renderArenaSummary(arenaSpec) {
  const statusLine = arenaSpec.status === "confirmed"
    ? `Confirmed at: ${arenaSpec.confirmedAt}`
    : "Needs review and confirmation before runs.";

  return [
    `# ${arenaSpec.arenaName} Arena`,
    "",
    `Status: ${arenaSpec.status}`,
    statusLine,
    "",
    `Question: ${arenaSpec.question}`,
    `Setup mode: ${arenaSpec.setupMode}`,
    `Horizon: ${arenaSpec.horizonDays} days`,
    `Adapter: ${arenaSpec.adapter.id} (${arenaSpec.adapter.domain})`,
    "",
    ...section("Actors:", arenaSpec.actors, (actor) => `- ${actor.label}: ${actor.description}`),
    ...section("Actions:", arenaSpec.actions, (action) => `- ${action.label}: ${action.description}`),
    ...section("Constraints:", arenaSpec.constraints, (constraint) => `- ${constraint.label}: ${constraint.description}`),
    ...section(
      "Shocks:",
      arenaSpec.shocks?.length ? arenaSpec.shocks : [{ day: "-", label: "None configured", type: "none", severity: 0 }],
      (shock) => `- Day ${shock.day}: ${shock.label} (${shock.type}, severity ${shock.severity})`
    ),
    ...section("Metrics:", arenaSpec.metrics?.catalog, (metric) => `- ${metric.label}: ${metric.description}`),
    ...section("Policies:", arenaSpec.policies, (policy) => `- ${policy.label}: ${policy.description}`),
    ...section("Assumptions:", arenaSpec.assumptions, (assumption) => `- ${assumption}`),
    ...section("Source files:", arenaSpec.sources?.files, (file) => `- ${file}`),
    arenaSpec.status === "draft"
      ? "Review this draft, make edits if needed, then confirm the arena."
      : "Arena confirmed. You can now generate an environment and run tournaments."
  ].join("\n");
}

export function renderEnvironmentSummary(arenaSpec, environment) {
  const summaryLines = [];
  if (environment.summary?.entityLabel && Number.isFinite(environment.summary?.entityCount)) {
    summaryLines.push(`${environment.summary.entityLabel}: ${environment.summary.entityCount}`);
  } else if (Array.isArray(environment.entities)) {
    summaryLines.push(`Entities: ${environment.entities.length}`);
  }
  if (environment.summary?.inputDir) summaryLines.push(`Input directory: ${environment.summary.inputDir}`);
  for (const note of environment.summary?.notes || []) summaryLines.push(note);

  return [
    `# ${environment.arena} Environment`,
    "",
    `Source arena: ${arenaSpec.arenaId}`,
    `Arena status: ${arenaSpec.status}`,
    `Question: ${environment.question}`,
    ...summaryLines,
    "",
    "Active shocks:",
    ...((environment.shocks?.length
      ? environment.shocks
      : [{ day: "-", label: "None configured", type: "none", severity: 0 }]).map(
      (shock) => `- Day ${shock.day}: ${shock.label} (${shock.type}, severity ${shock.severity})`
    ))
  ].join("\n");
}

export async function writeArenaArtifacts(workspace, arenaSpec) {
  const paths = arenaPaths(workspace, arenaSpec.arenaId);
  await mkdir(paths.arenaDir, { recursive: true });
  await writeJson(paths.arenaJson, arenaSpec);
  await writeFile(paths.arenaSummary, `${renderArenaSummary(arenaSpec)}\n`);
  return paths;
}

export async function writeEnvironmentArtifacts(workspace, arenaSpec, environment) {
  const paths = arenaPaths(workspace, arenaSpec.arenaId);
  await mkdir(paths.envDir, { recursive: true });
  await writeJson(paths.envJson, environment);
  await writeFile(paths.envSummary, `${renderEnvironmentSummary(arenaSpec, environment)}\n`);
  return { paths, environment };
}

export async function loadArenaSpec(workspace, arenaId) {
  return readJson(arenaPaths(workspace, arenaId).arenaJson);
}

export async function loadEnvironment(workspace, arenaId) {
  return readJson(arenaPaths(workspace, arenaId).envJson);
}
