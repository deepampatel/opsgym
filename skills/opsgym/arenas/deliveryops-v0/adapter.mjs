import { createDemoArenaAdapter } from "../../scripts/lib/demo-arena-factory.mjs";

const adapter = createDemoArenaAdapter({
  adapterMeta: {
    id: "deliveryops-v0",
    version: "0.1",
    domain: "delivery-ops",
    description: "Rider allocation, SLA pressure, rain shocks, surge demand, and refund risk."
  },
  arenaName: "DeliveryOps-v0",
  defaultQuestion: "Should a delivery marketplace push surge acceptance or protect SLA during rain?",
  entityLabel: "Delivery zones",
  entityStatLabels: {
    demand: "Orders",
    fragility: "Refund risk",
    priority: "Premium mix",
    reliability: "Route health"
  },
  actors: [
    { id: "dispatcher", label: "Dispatcher", description: "Allocates riders, batching, surge acceptance, and fallback capacity." },
    { id: "zones", label: "Delivery zones", description: "Neighborhoods with different order density, route reliability, and refund risk." },
    { id: "customers", label: "Customers", description: "Demand source with churn and refund sensitivity." },
    { id: "riders", label: "Riders", description: "Limited flexible capacity under weather and peak-hour pressure." }
  ],
  actions: [
    { id: "allocate_riders", label: "Allocate riders", description: "Move rider capacity across zones." },
    { id: "accept_surge", label: "Accept surge", description: "Choose how aggressively to accept incremental demand." },
    { id: "batch_orders", label: "Batch orders", description: "Trade speed for throughput." },
    { id: "use_fallback_fleet", label: "Use fallback fleet", description: "Buy expensive temporary rider capacity." }
  ],
  constraints: [
    { id: "rider_capacity", label: "Rider capacity", description: "Only so many delivery minutes are available." },
    { id: "sla_window", label: "SLA window", description: "Late deliveries create refunds and churn." },
    { id: "weather", label: "Weather", description: "Rain slows routes unevenly." }
  ],
  shocks: [
    { id: "rain-peak", type: "rain_delay", label: "Rain slows east and old-city routes", day: 3, severity: 0.44 },
    { id: "dinner-surge", type: "demand_surge", label: "Dinner order spike", day: 4, severity: 0.38 }
  ],
  assumptions: [
    "Throughput represents completed delivery work, not gross marketplace revenue.",
    "Risk includes refund, churn, and rider fatigue pressure.",
    "Fallback capacity improves service but raises operating cost."
  ],
  resources: { capacity: 470, budget: 120000 },
  dynamics: { throughputWeight: 5.2, backlogWeight: 4.5, costWeight: 1.25, riskWeight: 2.7 },
  entities: [
    { id: "central", name: "Central", label: "dense premium zone", demand: 32, fragility: 0.42, priority: 0.88, reliability: 0.84 },
    { id: "east", name: "East Ring", label: "rain-sensitive route", demand: 28, fragility: 0.58, priority: 0.7, reliability: 0.72 },
    { id: "old-city", name: "Old City", label: "narrow lanes", demand: 24, fragility: 0.66, priority: 0.62, reliability: 0.64 },
    { id: "tech-park", name: "Tech Park", label: "office dinner burst", demand: 30, fragility: 0.36, priority: 0.82, reliability: 0.9 },
    { id: "suburb", name: "Suburb", label: "long-haul orders", demand: 22, fragility: 0.5, priority: 0.55, reliability: 0.76 }
  ],
  policies: {
    "sla-shield": { name: "SLA Shield", description: "Protect late-risk zones and buy fallback capacity before refunds spike.", capacityAggression: 0.48, riskTolerance: 0.38, executionAggression: 0.92, fallbackRecovery: 0.95, priorityFocus: 0.9 },
    "surge-max": { name: "Surge Max", description: "Accept more demand and push rider utilization hard during peaks.", capacityAggression: 0.82, riskTolerance: 0.78, executionAggression: 1.12, fallbackRecovery: 0.62, priorityFocus: 0.48 },
    "balanced-dispatch": { name: "Balanced Dispatch", description: "Split capacity between premium SLA and high-density throughput.", capacityAggression: 0.62, riskTolerance: 0.55, executionAggression: 1, fallbackRecovery: 0.78, priorityFocus: 0.72 }
  }
});

export const adapterMeta = adapter.adapterMeta;
export const buildDraftArena = adapter.buildDraftArena;
export const materializeEnvironment = adapter.materializeEnvironment;
export const listPolicies = adapter.listPolicies;
export const runPolicy = adapter.runPolicy;
export const summarizeScoreboard = adapter.summarizeScoreboard;
