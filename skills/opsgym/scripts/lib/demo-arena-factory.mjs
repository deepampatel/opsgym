import { createAdapterDescriptor, OPSGYM_SCHEMA_VERSION } from "./contracts.mjs";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}

function rng(seed) {
  let h = 2166136261;
  for (const char of String(seed)) {
    h ^= char.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += h << 13;
    h ^= h >>> 7;
    h += h << 3;
    h ^= h >>> 17;
    h += h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
}

function humanize(id) {
  return String(id)
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function activeShock(environment, day, random) {
  let pressure = 0;
  for (const shock of environment.shocks || []) {
    const distance = Math.abs(Number(shock.day || 1) - day);
    const spillover = distance === 0 ? 1 : distance === 1 ? 0.35 : 0;
    pressure += Number(shock.severity || 0) * spillover * (0.75 + random() * 0.5);
  }
  return clamp(pressure, 0, 1.4);
}

function defaultPolicy(policyKey, policies) {
  const policy = policies[policyKey];
  if (!policy) return { name: humanize(policyKey), description: "Custom policy." };
  return policy;
}

function aggregate(policyKey, rollouts, policies) {
  const policy = defaultPolicy(policyKey, policies);
  const metrics = Object.keys(rollouts[0]?.metrics || {});
  const averages = {};
  for (const metric of metrics) {
    const values = rollouts.map((rollout) => rollout.metrics[metric]);
    const digits = metric === "serviceLevel" ? 3 : 0;
    averages[metric] = Number((values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)).toFixed(digits));
  }
  return {
    policy: policyKey,
    policyName: policy.name,
    description: policy.description,
    averages
  };
}

function winsByRollout(allRollouts, policies) {
  const byIndex = new Map();
  for (const rollout of allRollouts) {
    const current = byIndex.get(rollout.rolloutIndex);
    if (!current || rollout.metrics.opsScore > current.metrics.opsScore) byIndex.set(rollout.rolloutIndex, rollout);
  }
  const wins = Object.fromEntries(Object.keys(policies).map((policy) => [policy, 0]));
  for (const winner of byIndex.values()) wins[winner.policy] += 1;
  return wins;
}

export function createDemoArenaAdapter(config) {
  const policies = config.policies;
  const metricCatalog = [
    { id: "throughput", label: config.metricLabels?.throughput || "Throughput", unit: "count", description: config.metricDescriptions?.throughput || "Completed work in the simulation horizon." },
    { id: "serviceLevel", label: config.metricLabels?.serviceLevel || "Service level", unit: "ratio", description: "Completed demand as a fraction of total demand." },
    { id: "backlog", label: config.metricLabels?.backlog || "Backlog", unit: "count", description: "Unserved demand carried or lost during the run." },
    { id: "operatingCost", label: config.metricLabels?.operatingCost || "Operating cost", unit: "count", description: "Cost of capacity, fallback, overtime, or expedite actions." },
    { id: "risk", label: config.metricLabels?.risk || "Risk", unit: "count", description: "Domain risk created by aggressive or fragile decisions." },
    { id: "opsScore", label: "OpsScore", unit: "count", description: "Composite score used for tournament ranking." }
  ];

  return {
    adapterMeta: config.adapterMeta,

    async buildDraftArena({ arenaId = config.adapterMeta.id, question = config.defaultQuestion, days = config.defaultDays || 7, setupMode = "fast" }) {
      return {
        schemaVersion: OPSGYM_SCHEMA_VERSION,
        arenaId,
        arenaName: config.arenaName,
        adapter: createAdapterDescriptor(config.adapterMeta),
        status: "draft",
        setupMode,
        question,
        horizonDays: Number(days),
        createdAt: new Date().toISOString(),
        confirmedAt: null,
        actors: config.actors,
        actions: config.actions,
        constraints: config.constraints,
        policies: Object.entries(policies).map(([id, policy]) => ({ id, label: policy.name, description: policy.description })),
        shocks: config.shocks,
        metrics: {
          primary: "opsScore",
          raw: ["throughput", "serviceLevel", "backlog", "operatingCost", "risk"],
          catalog: metricCatalog
        },
        assumptions: config.assumptions,
        entities: config.entities,
        resources: config.resources,
        dynamics: config.dynamics || {}
      };
    },

    materializeEnvironment(arenaSpec) {
      return {
        schemaVersion: arenaSpec.schemaVersion,
        arena: arenaSpec.arenaName,
        id: arenaSpec.arenaId,
        adapter: arenaSpec.adapter,
        question: arenaSpec.question,
        horizonDays: arenaSpec.horizonDays,
        createdAt: new Date().toISOString(),
        arenaStatus: arenaSpec.status,
        arenaConfirmedAt: arenaSpec.confirmedAt,
        policies: arenaSpec.policies,
        entities: arenaSpec.entities.map((entity) => ({
          id: entity.id,
          name: entity.name,
          label: entity.label,
          stats: [
            { label: config.entityStatLabels?.demand || "Demand", value: entity.demand },
            { label: config.entityStatLabels?.fragility || "Fragility", value: `${Math.round(entity.fragility * 100)}%` },
            { label: config.entityStatLabels?.priority || "Priority", value: `${Math.round(entity.priority * 100)}%` },
            { label: config.entityStatLabels?.reliability || "Reliability", value: `${Math.round(entity.reliability * 100)}%` }
          ]
        })),
        simulationEntities: arenaSpec.entities,
        resources: arenaSpec.resources,
        shocks: arenaSpec.shocks,
        dynamics: arenaSpec.dynamics,
        metrics: arenaSpec.metrics,
        summary: {
          entityLabel: config.entityLabel,
          entityCount: arenaSpec.entities.length,
          notes: [
            `Capacity pool: ${arenaSpec.resources.capacity}`,
            `Budget pool: ${arenaSpec.resources.budget}`
          ]
        }
      };
    },

    listPolicies() {
      return { ...policies };
    },

    runPolicy({ environment, policyKey, policyConfig, rolloutIndex, seed }) {
      const policy = policyConfig || defaultPolicy(policyKey, policies);
      const random = rng(`${seed}:${policyKey}:${rolloutIndex}`);
      let throughput = 0;
      let demandTotal = 0;
      let backlog = 0;
      let operatingCost = 0;
      let risk = 0;
      const daily = [];

      for (let day = 1; day <= environment.horizonDays; day += 1) {
        const shock = activeShock(environment, day, random);
        let capacity = environment.resources.capacity * (1 - shock * (1 - policy.routePriority) * 0.45);
        capacity *= 0.9 + random() * 0.22;
        const dayRow = { day, shock: Number(shock.toFixed(3)), entities: [] };
        const entities = [...environment.simulationEntities].sort((a, b) => {
          const aScore = policy.routePriority * a.reliability + policy.riskTolerance * a.priority + random() * 0.04;
          const bScore = policy.routePriority * b.reliability + policy.riskTolerance * b.priority + random() * 0.04;
          return bScore - aScore;
        });

        for (const entity of entities) {
          const demand = Math.max(0, Math.round(entity.demand * (0.82 + random() * 0.38) * (1 + shock * entity.fragility)));
          const fragilityPenalty = shock * entity.fragility * (1 - policy.upiFallback) * 0.55;
          const target = demand * policy.stockAggression * (1 - fragilityPenalty);
          const served = Math.max(0, Math.min(Math.round(capacity), Math.round(target)));
          capacity -= served;

          const missed = Math.max(0, demand - served);
          const exposure = served * policy.creditAggression * entity.fragility * (0.45 + policy.riskTolerance);
          const fallbackCost = missed * policy.upiFallback * (0.35 + shock);
          const cost = served * (0.22 + policy.stockAggression * 0.09) + fallbackCost + exposure * 0.18;
          const entityRisk = exposure * (1 - entity.reliability + entity.fragility * 0.5) + missed * entity.priority * shock;

          demandTotal += demand;
          throughput += served;
          backlog += missed;
          operatingCost += cost;
          risk += entityRisk;
          dayRow.entities.push({
            entity: entity.name,
            demand,
            served,
            missed,
            cost: Math.round(cost),
            risk: Math.round(entityRisk)
          });
        }
        daily.push(dayRow);
      }

      const serviceLevel = throughput / Math.max(1, demandTotal);
      const opsScore = 1000
        + throughput * Number(environment.dynamics.throughputWeight || 5)
        + serviceLevel * 550
        - backlog * Number(environment.dynamics.backlogWeight || 4)
        - operatingCost * Number(environment.dynamics.costWeight || 1.2)
        - risk * Number(environment.dynamics.riskWeight || 2.4);

      return {
        policy: policyKey,
        policyName: policy.name,
        description: policy.description,
        rolloutIndex,
        metrics: {
          throughput: Math.round(throughput),
          serviceLevel: Number(serviceLevel.toFixed(3)),
          backlog: Math.round(backlog),
          operatingCost: Math.round(operatingCost),
          risk: Math.round(risk),
          opsScore: Math.round(opsScore)
        },
        daily
      };
    },

    summarizeScoreboard({ allRollouts, policies: customPolicies = policies }) {
      const scoreboard = Object.keys(customPolicies)
        .map((policyKey) => aggregate(policyKey, allRollouts.filter((rollout) => rollout.policy === policyKey), customPolicies))
        .sort((a, b) => b.averages.opsScore - a.averages.opsScore);
      return {
        scoreboard,
        wins: winsByRollout(allRollouts, customPolicies)
      };
    }
  };
}
