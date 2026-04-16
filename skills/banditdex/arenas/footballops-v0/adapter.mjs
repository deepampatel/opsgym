import { createDemoArenaAdapter } from "../../scripts/lib/demo-arena-factory.mjs";

const adapter = createDemoArenaAdapter({
  adapterMeta: {
    id: "footballops-v0",
    version: "0.1",
    domain: "sports-ops",
    description: "Player minutes, fixture congestion, injury risk, rotation, pressing intensity, and match readiness."
  },
  arenaName: "FootballOps-v0",
  defaultQuestion: "Should a football club rotate heavily or push starters through fixture congestion?",
  entityLabel: "Squad groups",
  entityStatLabels: {
    demand: "Minutes need",
    fragility: "Injury risk",
    priority: "Match impact",
    reliability: "Fitness"
  },
  actors: [
    { id: "head-coach", label: "Head coach", description: "Chooses rotation, pressing, and substitution posture." },
    { id: "medical-team", label: "Medical team", description: "Warns about injury risk and recovery load." },
    { id: "squad", label: "Squad groups", description: "Player groups with different fitness, impact, and fatigue risk." },
    { id: "opponents", label: "Opponents", description: "Fixture difficulty creates performance pressure." }
  ],
  actions: [
    { id: "rotate_players", label: "Rotate players", description: "Choose how much to rest starters." },
    { id: "press_intensity", label: "Press intensity", description: "Trade chance creation for fatigue and injury risk." },
    { id: "protect_minutes", label: "Protect minutes", description: "Cap fragile players and use bench depth." },
    { id: "prioritize_fixture", label: "Prioritize fixture", description: "Bias strongest XI toward specific matches." }
  ],
  constraints: [
    { id: "fitness", label: "Fitness", description: "Player recovery limits sustainable minutes." },
    { id: "fixture_congestion", label: "Fixture congestion", description: "Matches close together reduce reliability." },
    { id: "squad_depth", label: "Squad depth", description: "Bench quality limits rotation upside." }
  ],
  shocks: [
    { id: "midweek-cup", type: "fixture_congestion", label: "Midweek cup tie compresses recovery", day: 3, severity: 0.42 },
    { id: "derby-pressure", type: "opponent_pressure", label: "High-intensity derby", day: 5, severity: 0.36 }
  ],
  assumptions: [
    "Throughput represents effective match contribution, not goals directly.",
    "Risk includes injury exposure and fatigue accumulation.",
    "Backlog represents unfulfilled tactical minutes or underprepared roles."
  ],
  resources: { capacity: 430, budget: 90000 },
  dynamics: { throughputWeight: 5.8, backlogWeight: 4.2, costWeight: 0.8, riskWeight: 3.1 },
  entities: [
    { id: "starters", name: "Starters", label: "highest impact XI", demand: 34, fragility: 0.58, priority: 0.98, reliability: 0.78 },
    { id: "bench", name: "Bench", label: "rotation depth", demand: 26, fragility: 0.34, priority: 0.62, reliability: 0.86 },
    { id: "youth", name: "Youth", label: "development minutes", demand: 18, fragility: 0.38, priority: 0.42, reliability: 0.74 },
    { id: "returning", name: "Returning Players", label: "post-injury minutes", demand: 16, fragility: 0.82, priority: 0.7, reliability: 0.58 },
    { id: "pressers", name: "High Press Unit", label: "intensity specialists", demand: 24, fragility: 0.62, priority: 0.84, reliability: 0.72 }
  ],
  policies: {
    "rotate-protect": { name: "Rotate and Protect", description: "Cap fragile minutes and use bench depth to preserve fitness.", capacityAggression: 0.42, riskTolerance: 0.3, executionAggression: 0.86, fallbackRecovery: 0.78, priorityFocus: 0.92 },
    "full-strength": { name: "Full Strength Push", description: "Use strongest players and pressing intensity to maximize match impact.", capacityAggression: 0.86, riskTolerance: 0.78, executionAggression: 1.13, fallbackRecovery: 0.48, priorityFocus: 0.46 },
    "fixture-priority": { name: "Fixture Priority", description: "Protect some groups while targeting the highest-pressure match.", capacityAggression: 0.64, riskTolerance: 0.54, executionAggression: 1, fallbackRecovery: 0.66, priorityFocus: 0.76 }
  }
});

export const adapterMeta = adapter.adapterMeta;
export const buildDraftArena = adapter.buildDraftArena;
export const materializeEnvironment = adapter.materializeEnvironment;
export const listPolicies = adapter.listPolicies;
export const runPolicy = adapter.runPolicy;
export const summarizeScoreboard = adapter.summarizeScoreboard;
