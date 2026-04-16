import { createDemoArenaAdapter } from "../../scripts/lib/demo-arena-factory.mjs";

const adapter = createDemoArenaAdapter({
  adapterMeta: {
    id: "hospitalops-v0",
    version: "0.1",
    domain: "hospital-ops",
    description: "Bed allocation, triage queues, staff fatigue, elective deferrals, and emergency surges."
  },
  arenaName: "HospitalOps-v0",
  defaultQuestion: "Should a hospital defer elective work to protect emergency capacity during a surge?",
  entityLabel: "Care units",
  entityStatLabels: {
    demand: "Cases",
    fragility: "Clinical risk",
    priority: "Acuity",
    reliability: "Staff cover"
  },
  actors: [
    { id: "bed-manager", label: "Bed manager", description: "Allocates beds and escalation capacity." },
    { id: "triage", label: "Triage desk", description: "Prioritizes incoming patients under queue pressure." },
    { id: "clinical-units", label: "Clinical units", description: "Departments competing for staff, beds, and diagnostics." },
    { id: "admin", label: "Administration", description: "Decides elective deferrals and overtime budget." }
  ],
  actions: [
    { id: "allocate_beds", label: "Allocate beds", description: "Shift capacity between emergency, ICU, ward, and elective units." },
    { id: "call_overtime", label: "Call overtime", description: "Increase capacity at staff fatigue cost." },
    { id: "defer_elective", label: "Defer elective work", description: "Protect emergency flow by moving scheduled work." },
    { id: "fast_track", label: "Fast-track triage", description: "Use protocols to reduce queue time for low-risk cases." }
  ],
  constraints: [
    { id: "bed_capacity", label: "Bed capacity", description: "Physical staffed beds limit throughput." },
    { id: "staff_fatigue", label: "Staff fatigue", description: "Overtime creates safety and retention risk." },
    { id: "clinical_acuity", label: "Clinical acuity", description: "Some queues carry high harm risk if delayed." }
  ],
  shocks: [
    { id: "flu-surge", type: "arrival_surge", label: "Respiratory surge hits emergency", day: 2, severity: 0.46 },
    { id: "staff-sick", type: "capacity_drop", label: "Nurse sickness reduces staffed beds", day: 4, severity: 0.34 }
  ],
  assumptions: [
    "Throughput represents safe completed care episodes.",
    "Risk includes delayed high-acuity care, fatigue, and deferral harm.",
    "Operating cost stands in for overtime and escalation burden."
  ],
  resources: { capacity: 390, budget: 180000 },
  dynamics: { throughputWeight: 6, backlogWeight: 5.5, costWeight: 1.05, riskWeight: 3.4 },
  entities: [
    { id: "emergency", name: "Emergency", label: "unscheduled arrivals", demand: 34, fragility: 0.78, priority: 0.96, reliability: 0.76 },
    { id: "icu", name: "ICU", label: "high acuity beds", demand: 14, fragility: 0.9, priority: 1, reliability: 0.82 },
    { id: "ward", name: "Ward", label: "step-down flow", demand: 28, fragility: 0.52, priority: 0.72, reliability: 0.86 },
    { id: "diagnostics", name: "Diagnostics", label: "scan bottleneck", demand: 24, fragility: 0.44, priority: 0.68, reliability: 0.78 },
    { id: "elective", name: "Elective", label: "scheduled procedures", demand: 20, fragility: 0.36, priority: 0.45, reliability: 0.9 }
  ],
  policies: {
    "emergency-shield": { name: "Emergency Shield", description: "Defer lower-acuity work and route capacity to emergency and ICU.", capacityAggression: 0.5, riskTolerance: 0.34, executionAggression: 0.96, fallbackRecovery: 0.86, priorityFocus: 0.94 },
    "throughput-push": { name: "Throughput Push", description: "Use overtime to keep all units moving despite fatigue risk.", capacityAggression: 0.86, riskTolerance: 0.72, executionAggression: 1.1, fallbackRecovery: 0.72, priorityFocus: 0.58 },
    "defer-and-stabilize": { name: "Defer and Stabilize", description: "Sacrifice elective throughput to reduce harm and staff stress under surge.", capacityAggression: 0.36, riskTolerance: 0.28, executionAggression: 0.84, fallbackRecovery: 0.8, priorityFocus: 0.88 }
  }
});

export const adapterMeta = adapter.adapterMeta;
export const buildDraftArena = adapter.buildDraftArena;
export const materializeEnvironment = adapter.materializeEnvironment;
export const listPolicies = adapter.listPolicies;
export const runPolicy = adapter.runPolicy;
export const summarizeScoreboard = adapter.summarizeScoreboard;
