#!/usr/bin/env node
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { SKILL_DIR } from "./lib/workspace.mjs";
import { fileExists } from "./lib/config.mjs";

const SUGGESTED = [
  { id: "footballops-v0", domain: "sports-ops", description: "Fixture congestion, player minutes, injury risk, and tactical policies." },
  { id: "deliveryops-v0", domain: "delivery-ops", description: "Rider allocation, dark-store inventory, surge pricing, and SLA risk." },
  { id: "hospitalops-v0", domain: "healthcare-ops", description: "Bed capacity, staff rosters, triage queues, and emergency surges." }
];

async function installedAdapters() {
  const arenasDir = resolve(SKILL_DIR, "arenas");
  if (!(await fileExists(arenasDir))) return [];
  const entries = await readdir(arenasDir, { withFileTypes: true });
  const adapters = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const adapterPath = resolve(arenasDir, entry.name, "adapter.mjs");
    if (!(await fileExists(adapterPath))) continue;
    const adapter = await import(pathToFileURL(adapterPath).href);
    adapters.push({
      id: adapter.adapterMeta?.id || entry.name,
      domain: adapter.adapterMeta?.domain || "decision-ops",
      version: adapter.adapterMeta?.version || "0.1",
      description: adapter.adapterMeta?.description || "Arena adapter",
      path: adapterPath
    });
  }

  return adapters.sort((a, b) => a.id.localeCompare(b.id));
}

async function main() {
  const installed = await installedAdapters();
  console.log("Installed runnable adapters:");
  if (!installed.length) {
    console.log("- none");
  } else {
    for (const adapter of installed) {
      console.log(`- ${adapter.id} (${adapter.domain}, v${adapter.version}): ${adapter.description}`);
    }
  }

  const installedIds = new Set(installed.map((adapter) => adapter.id));
  const suggested = SUGGESTED.filter((adapter) => !installedIds.has(adapter.id));
  console.log("");
  console.log("Designable, but not runnable until an adapter is created:");
  if (!suggested.length) {
    console.log("- none from the bundled suggestion list");
  } else {
    for (const adapter of suggested) {
      console.log(`- ${adapter.id} (${adapter.domain}): ${adapter.description}`);
    }
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
