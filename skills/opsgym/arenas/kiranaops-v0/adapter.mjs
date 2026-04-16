import { resolve } from "node:path";
import { OPSGYM_SCHEMA_VERSION, createAdapterDescriptor } from "../../scripts/lib/contracts.mjs";
import { SKILL_DIR, readMaybe, slug } from "../../scripts/lib/workspace.mjs";

export const adapterMeta = {
  id: "kiranaops-v0",
  version: "0.1",
  domain: "retail-ops",
  description: "Kirana distribution, credit, payment, and route simulation."
};

const ACTION_CATALOG = {
  allocate_stock: {
    id: "allocate_stock",
    label: "Allocate stock",
    description: "Distribute limited inventory across stores before daily demand lands."
  },
  extend_credit: {
    id: "extend_credit",
    label: "Extend distributor credit",
    description: "Approve or limit store-level distributor credit."
  },
  prioritize_route: {
    id: "prioritize_route",
    label: "Prioritize route",
    description: "Pull scarce van capacity toward high-risk or high-upside routes."
  },
  approve_working_capital: {
    id: "approve_working_capital",
    label: "Approve working capital",
    description: "Release lender-backed working capital for stores with strong signals."
  },
  use_upi_fallback: {
    id: "use_upi_fallback",
    label: "Use UPI fallback",
    description: "Preserve sales during payment failure through cash or customer-credit fallback."
  }
};

const CONSTRAINT_CATALOG = {
  credit_pool: {
    id: "credit_pool",
    label: "Credit pool",
    description: "The distributor has a finite INR pool for exposure."
  },
  van_capacity: {
    id: "van_capacity",
    label: "Van capacity",
    description: "Routes can only deliver a fixed number of units per day."
  },
  route_reliability: {
    id: "route_reliability",
    label: "Route reliability",
    description: "Rain and traffic reduce how much stock actually lands."
  },
  payment_fragility: {
    id: "payment_fragility",
    label: "Payment fragility",
    description: "UPI failures block demand unless the policy can absorb fallback."
  },
  store_trust_variance: {
    id: "store_trust_variance",
    label: "Store trust variance",
    description: "Stores have different repayment quality and delay histories."
  }
};

const SHOCK_CATALOG = {
  festival_demand: {
    id: "festival_demand",
    label: "Festival demand",
    description: "Demand spikes and SKU mix shifts around festive baskets."
  },
  upi_failure: {
    id: "upi_failure",
    label: "UPI failure",
    description: "Digital payment reliability drops during busy periods."
  },
  rain_delay: {
    id: "rain_delay",
    label: "Rain delay",
    description: "Routes lose service reliability because of weather."
  },
  competitor_discount: {
    id: "competitor_discount",
    label: "Competitor discount",
    description: "Nearby stores cut prices and leak demand."
  },
  supplier_shortfall: {
    id: "supplier_shortfall",
    label: "Supplier shortfall",
    description: "One constrained SKU arrives short."
  }
};

const METRIC_CATALOG = {
  grossMargin: {
    id: "grossMargin",
    label: "Gross margin",
    unit: "inr",
    description: "Realized margin from fulfilled product demand."
  },
  lostSales: {
    id: "lostSales",
    label: "Lost sales",
    unit: "inr",
    description: "Demand that leaked because the policy could not serve it."
  },
  stockoutUnits: {
    id: "stockoutUnits",
    label: "Stockout units",
    unit: "count",
    description: "Units demanded but not served."
  },
  creditExposure: {
    id: "creditExposure",
    label: "Credit exposure",
    unit: "inr",
    description: "Receivables created by distributor or customer-credit fallback."
  },
  repaymentRisk: {
    id: "repaymentRisk",
    label: "Repayment risk",
    unit: "inr",
    description: "Risk-adjusted exposure after trust and delinquency are applied."
  },
  serviceLevel: {
    id: "serviceLevel",
    label: "Service level",
    unit: "ratio",
    description: "Served demand as a fraction of total demand."
  },
  opsScore: {
    id: "opsScore",
    label: "OpsScore",
    unit: "score",
    description: "Risk-adjusted overall score used for policy ranking."
  }
};

const POLICY_CATALOG = {
  conservative: {
    id: "conservative",
    label: "Conservative",
    description: "Protects cash and limits risky receivables."
  },
  growth: {
    id: "growth",
    label: "Growth",
    description: "Pushes inventory and credit for top-line sales."
  },
  "risk-balanced": {
    id: "risk-balanced",
    label: "Risk-balanced",
    description: "Expands where demand and repayment signals agree."
  },
  "adaptive-upi-fallback": {
    id: "adaptive-upi-fallback",
    label: "Adaptive UPI fallback",
    description: "Pre-positions stock and leans on selective payment fallback."
  }
};

const POLICIES = {
  conservative: {
    name: "Conservative",
    description: "Protects cash, limits receivables, and prioritizes only the safest stores.",
    creditAggression: 0.32,
    riskTolerance: 0.28,
    stockAggression: 0.72,
    upiFallback: 0.18,
    routePriority: 0.34
  },
  growth: {
    name: "Growth",
    description: "Pushes festival inventory and credit to maximize top-line sales.",
    creditAggression: 0.92,
    riskTolerance: 0.78,
    stockAggression: 1,
    upiFallback: 0.58,
    routePriority: 0.46
  },
  "risk-balanced": {
    name: "Risk-balanced",
    description: "Extends credit selectively where repayment and demand signals agree.",
    creditAggression: 0.62,
    riskTolerance: 0.52,
    stockAggression: 0.88,
    upiFallback: 0.42,
    routePriority: 0.62
  },
  "adaptive-upi-fallback": {
    name: "Adaptive UPI fallback",
    description: "Pre-positions constrained SKUs and uses selective customer-credit fallback on UPI-heavy stores.",
    creditAggression: 0.66,
    riskTolerance: 0.62,
    stockAggression: 1.02,
    upiFallback: 0.95,
    routePriority: 0.96
  }
};

function humanizeSlug(value) {
  return String(value)
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseCsv(text) {
  const rows = text.trim().split(/\r?\n/).filter(Boolean);
  if (rows.length < 2) return [];
  const headers = rows[0].split(",").map((header) => header.trim());
  return rows.slice(1).map((row) => {
    const cells = row.split(",").map((cell) => cell.trim());
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function parseOrders(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const [store, sku, units, note] = line.split("|").map((part) => part.trim());
      return {
        store,
        sku,
        units: Number(units || 0),
        note: note || ""
      };
    })
    .filter((row) => row.store && row.sku && Number.isFinite(row.units));
}

function routeForStore(routeNotes, storeName) {
  const routeLine = routeNotes
    .split(/\r?\n/)
    .find((line) => line.toLowerCase().includes(storeName.toLowerCase()));
  const match = routeLine?.match(/Route\s+([A-Z])/i);
  return match ? `route-${match[1].toLowerCase()}` : "route-a";
}

function buildStores({ orders, upiRows, invoiceRows, routeNotes }) {
  const names = new Set([
    ...orders.map((order) => order.store),
    ...upiRows.map((row) => row.store),
    ...invoiceRows.map((row) => row.store)
  ]);

  return [...names].sort().map((name, index) => {
    const upi = upiRows.find((row) => row.store === name) ?? {};
    const invoice = invoiceRows.find((row) => row.store === name) ?? {};
    const storeOrders = orders.filter((order) => order.store === name);
    const requestedUnits = {};
    for (const order of storeOrders) {
      requestedUnits[order.sku] = (requestedUnits[order.sku] ?? 0) + order.units;
    }

    const successRate = Number(upi.success_rate ?? 0.93);
    const daysLate = Number(invoice.days_late ?? index * 4);
    const outstanding = Number(invoice.outstanding ?? 45000 + index * 9000);
    const creditLimit = Number(invoice.credit_limit ?? 90000 + index * 10000);
    const upiShare = Number(upi.upi_share ?? 0.6);
    const transactions = Number(upi.transactions ?? 360);
    const avgTicket = Number(upi.avg_ticket ?? 180);

    const repaymentPressure = Math.min(1, outstanding / Math.max(1, creditLimit));
    const trustScore = Math.max(
      0.35,
      Math.min(0.98, successRate - daysLate / 90 - repaymentPressure * 0.12)
    );

    return {
      id: slug(name),
      name,
      segment: index % 2 === 0 ? "neighbourhood-kirana" : "high-footfall-mini-mart",
      trustScore: Number(trustScore.toFixed(2)),
      upiShare: Number(upiShare.toFixed(2)),
      customerCreditHabit: Number(Math.min(0.82, 0.25 + upiShare * 0.45 + daysLate / 160).toFixed(2)),
      footfallIndex: Number(Math.max(0.7, Math.min(1.45, transactions / 420)).toFixed(2)),
      cashReserve: Math.round(avgTicket * transactions * 0.22),
      creditLimit,
      outstanding,
      daysLate,
      route: routeForStore(routeNotes, name),
      requestedUnits
    };
  });
}

function catalogSelection(ids, catalog) {
  return ids.map((id) => catalog[id] ?? {
    id,
    label: humanizeSlug(id),
    description: `Custom ${humanizeSlug(id).toLowerCase()} setting.`
  });
}

function formatInr(value) {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function defaultShocks(selectedShockTypes) {
  return selectedShockTypes.map((type) => {
    if (type === "festival_demand") {
      return {
        id: "deepavali-demand",
        type,
        label: "Deepavali basket lift",
        day: 2,
        severity: 0.42,
        skuLift: { oil_1l: 0.35, sweets_box: 0.62, snack_pack: 0.22 }
      };
    }
    if (type === "upi_failure") {
      return {
        id: "upi-evening-dip",
        type,
        label: "UPI reliability dip during evening rush",
        day: 4,
        severity: 0.24,
        hours: "18:00-21:00"
      };
    }
    if (type === "rain_delay") {
      return {
        id: "monsoon-route-delay",
        type,
        label: "Monsoon delay on low roads",
        day: 5,
        severity: 0.22,
        affectedRoutes: ["route-c"]
      };
    }
    return {
      id: slug(type),
      type,
      label: humanizeSlug(type),
      day: 4,
      severity: 0.2
    };
  });
}

function hashSeed(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rng(seedText) {
  let state = hashSeed(seedText) || 123456789;
  return () => {
    state = Math.imul(1664525, state) + 1013904223;
    return ((state >>> 0) / 4294967296);
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function shockSeverity(environment, type, day, random) {
  return (environment.shocks || [])
    .filter((shock) => shock.type === type && Number(shock.day) === day)
    .reduce((total, shock) => total + Number(shock.severity || 0) * (0.82 + random() * 0.36), 0);
}

function festivalLift(environment, sku, day, random) {
  return (environment.shocks || [])
    .filter((shock) => shock.type === "festival_demand" && Number(shock.day) <= day)
    .reduce((lift, shock) => {
      const skuLift = Number(shock.skuLift?.[sku] ?? shock.severity ?? 0);
      return lift + skuLift * (0.9 + random() * 0.25);
    }, 0);
}

function allocateCredit(environment, policy) {
  const ranked = [...environment.stores].sort((a, b) => {
    const scoreA = a.trustScore * 1.6 + a.footfallIndex - a.daysLate / 45 - a.outstanding / Math.max(1, a.creditLimit);
    const scoreB = b.trustScore * 1.6 + b.footfallIndex - b.daysLate / 45 - b.outstanding / Math.max(1, b.creditLimit);
    return scoreB - scoreA;
  });

  let pool = environment.distributor.creditPool * policy.creditAggression;
  const approvals = {};
  for (const store of ranked) {
    const headroom = Math.max(0, store.creditLimit - store.outstanding);
    const risk = (1 - store.trustScore) + store.daysLate / 60 + store.customerCreditHabit * 0.2;
    const allowed = risk <= policy.riskTolerance || store.trustScore > 0.84;
    const demandSignal = Object.values(store.requestedUnits || {}).reduce((sum, units) => sum + units, 0);
    const target = Math.min(headroom, demandSignal * 430 * policy.creditAggression);
    const approved = allowed ? Math.min(pool, target) : Math.min(pool, target * 0.18);
    approvals[store.id] = Math.max(0, Math.round(approved));
    pool -= approvals[store.id];
  }
  return approvals;
}

function allocateStock(environment, policy) {
  const stock = {};
  const inventory = { ...environment.distributor.inventory };
  const stores = [...environment.stores].sort((a, b) => {
    const priorityA = a.footfallIndex + a.trustScore * 0.55 + (a.route === "route-c" ? policy.routePriority * 0.25 : 0);
    const priorityB = b.footfallIndex + b.trustScore * 0.55 + (b.route === "route-c" ? policy.routePriority * 0.25 : 0);
    return priorityB - priorityA;
  });

  for (const store of stores) {
    stock[store.id] = {};
    for (const [sku, product] of Object.entries(environment.products)) {
      const requested = Number(store.requestedUnits?.[sku] ?? product.baseDemand * store.footfallIndex * 3);
      const constraintPenalty = product.constrained ? 0.86 : 1;
      const target = Math.ceil(requested * policy.stockAggression * constraintPenalty);
      const allocated = Math.min(inventory[sku] ?? 0, target);
      stock[store.id][sku] = allocated;
      inventory[sku] = (inventory[sku] ?? 0) - allocated;
    }
  }

  return stock;
}

function policyDefinition(policyKey, policies = POLICIES) {
  const policy = policies[policyKey];
  if (!policy) {
    return {
      name: humanizeSlug(policyKey),
      description: "Custom policy."
    };
  }
  return policy;
}

function aggregateRollouts(policyKey, rollouts, policies = POLICIES) {
  const policy = policyDefinition(policyKey, policies);
  const metrics = Object.keys(rollouts[0]?.metrics || {});
  const averages = {};
  for (const metric of metrics) {
    const values = rollouts.map((rollout) => rollout.metrics[metric]);
    const digits = metric === "serviceLevel" ? 3 : 0;
    averages[metric] = Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(digits));
  }
  return {
    policy: policyKey,
    policyName: policy.name,
    description: policy.description,
    averages
  };
}

function winnersByRollout(allRollouts, policies = POLICIES) {
  const byIndex = new Map();
  for (const rollout of allRollouts) {
    const current = byIndex.get(rollout.rolloutIndex);
    if (!current || rollout.metrics.opsScore > current.metrics.opsScore) byIndex.set(rollout.rolloutIndex, rollout);
  }
  const wins = Object.fromEntries(Object.keys(policies).map((policy) => [policy, 0]));
  for (const winner of byIndex.values()) wins[winner.policy] += 1;
  return wins;
}

function entityCards(stores) {
  return stores.map((store) => ({
    id: store.id,
    name: store.name,
    label: store.segment,
    stats: [
      { label: "Trust", value: `${Math.round(store.trustScore * 100)}%` },
      { label: "UPI share", value: `${Math.round(store.upiShare * 100)}%` },
      { label: "Outstanding", value: formatInr(store.outstanding) },
      { label: "Route", value: store.route }
    ]
  }));
}

export async function buildDraftArena({
  arenaId = adapterMeta.id,
  inputDir,
  question = "Should Nandi FMCG extend extra festival credit to these kirana stores?",
  days = 7,
  setupMode = "fast",
  actionIds,
  constraintIds,
  shockTypes,
  metricIds,
  policyIds
}) {
  const resolvedInputDir = resolve(inputDir || `${SKILL_DIR}/assets/sample-data`);
  const [ordersText, upiText, invoiceText, routeNotes] = await Promise.all([
    readMaybe(resolve(resolvedInputDir, "whatsapp-orders.txt")),
    readMaybe(resolve(resolvedInputDir, "upi-settlements.csv")),
    readMaybe(resolve(resolvedInputDir, "distributor-invoices.csv")),
    readMaybe(resolve(resolvedInputDir, "route-notes.txt"))
  ]);

  const orders = parseOrders(ordersText);
  const upiRows = parseCsv(upiText);
  const invoiceRows = parseCsv(invoiceText);
  const stores = buildStores({ orders, upiRows, invoiceRows, routeNotes });

  const selectedActionIds = actionIds?.length ? actionIds : [
    "allocate_stock",
    "extend_credit",
    "prioritize_route",
    "approve_working_capital",
    "use_upi_fallback"
  ];
  const selectedConstraintIds = constraintIds?.length ? constraintIds : [
    "credit_pool",
    "van_capacity",
    "route_reliability",
    "payment_fragility",
    "store_trust_variance"
  ];
  const selectedShockTypes = shockTypes?.length ? shockTypes : [
    "festival_demand",
    "upi_failure",
    "rain_delay"
  ];
  const selectedMetricIds = metricIds?.length ? metricIds : [
    "grossMargin",
    "lostSales",
    "stockoutUnits",
    "creditExposure",
    "repaymentRisk",
    "serviceLevel",
    "opsScore"
  ];
  const selectedPolicyIds = policyIds?.length ? policyIds : [
    "conservative",
    "growth",
    "risk-balanced",
    "adaptive-upi-fallback"
  ];

  return {
    schemaVersion: OPSGYM_SCHEMA_VERSION,
    arenaId,
    arenaName: "KiranaOps-v0",
    adapter: createAdapterDescriptor(adapterMeta),
    status: "draft",
    setupMode,
    question,
    horizonDays: Number(days),
    createdAt: new Date().toISOString(),
    confirmedAt: null,
    actors: [
      { id: "distributor", label: "Distributor", description: "Allocates stock, route capacity, and distributor credit." },
      { id: "stores", label: `${stores.length} kirana stores`, description: "Stores with different trust, demand, and payment profiles." },
      { id: "customer-market", label: "Customer market", description: "Demand source with festival, payment, and competitor effects." },
      { id: "credit-officer", label: "Credit officer", description: "Approves working capital when policy allows it." }
    ],
    actions: catalogSelection(selectedActionIds, ACTION_CATALOG),
    constraints: catalogSelection(selectedConstraintIds, CONSTRAINT_CATALOG),
    policies: catalogSelection(selectedPolicyIds, POLICY_CATALOG),
    shocks: defaultShocks(selectedShockTypes),
    metrics: {
      primary: "opsScore",
      raw: selectedMetricIds.filter((id) => id !== "opsScore"),
      catalog: catalogSelection(selectedMetricIds, METRIC_CATALOG)
    },
    assumptions: [
      "The arena uses sample distributor and payment data unless the user overrides them.",
      "Route and payment shocks are modeled as probabilistic severity multipliers.",
      "OpsScore is the default ranking metric, but raw metrics remain available for debate."
    ],
    products: {
      oil_1l: { name: "Edible oil 1L", unitMargin: 32, baseDemand: 18, constrained: true },
      atta_5kg: { name: "Atta 5kg", unitMargin: 44, baseDemand: 14, constrained: false },
      sweets_box: { name: "Festival sweets box", unitMargin: 58, baseDemand: 16, constrained: true },
      snack_pack: { name: "Snack pack", unitMargin: 18, baseDemand: 26, constrained: false }
    },
    distributor: {
      name: "Nandi FMCG",
      creditPool: 240000,
      vanCapacityUnits: 1240,
      inventory: {
        oil_1l: 330,
        atta_5kg: 280,
        sweets_box: 360,
        snack_pack: 520
      },
      routes: {
        "route-a": { capacityUnits: 520, reliability: 0.94 },
        "route-b": { capacityUnits: 420, reliability: 0.86 },
        "route-c": { capacityUnits: 300, reliability: 0.82 }
      }
    },
    stores,
    sources: {
      inputDir: resolvedInputDir,
      files: ["whatsapp-orders.txt", "upi-settlements.csv", "distributor-invoices.csv", "route-notes.txt"]
    }
  };
}

export function materializeEnvironment(arenaSpec) {
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
    products: arenaSpec.products,
    distributor: arenaSpec.distributor,
    stores: arenaSpec.stores,
    entities: entityCards(arenaSpec.stores),
    shocks: arenaSpec.shocks,
    metrics: {
      primary: arenaSpec.metrics.primary,
      raw: arenaSpec.metrics.raw,
      catalog: arenaSpec.metrics.catalog
    },
    sources: arenaSpec.sources,
    summary: {
      entityLabel: "Stores",
      entityCount: arenaSpec.stores.length,
      inputDir: arenaSpec.sources.inputDir,
      notes: [
        `Distributor: ${arenaSpec.distributor.name}`,
        `Policies: ${arenaSpec.policies.length}`
      ]
    }
  };
}

export function buildShock(type, args) {
  const day = Number(args.day || 4);
  const severity = Math.max(0, Math.min(1, Number(args.severity || 0.35)));
  const label = args.label || `${type} shock on day ${day}`;
  const shock = {
    id: slug(`${type}-${day}-${label}`).slice(0, 80),
    type,
    label,
    day,
    severity
  };
  if (type === "upi_failure") shock.hours = args.hours || "18:00-22:00";
  if (type === "rain_delay") shock.affectedRoutes = (args.routes || "route-c").split(",").map((route) => route.trim());
  if (type === "festival_demand") shock.skuLift = { oil_1l: 0.25, sweets_box: 0.45, snack_pack: 0.2 };
  if (type === "supplier_shortfall") shock.sku = args.sku || "oil_1l";
  if (type === "competitor_discount") shock.affectedStores = (args.stores || "metro-mini-mart,shree-corner").split(",").map((store) => store.trim());
  return shock;
}

export function listPolicies() {
  return { ...POLICIES };
}

export function runPolicy({ environment, policyKey, policyConfig, rolloutIndex, seed }) {
  const policy = policyConfig || POLICIES[policyKey];
  if (!policy) throw new Error(`Unknown policy: ${policyKey}`);
  const random = rng(`${seed}:${policyKey}:${rolloutIndex}`);
  const creditApproved = allocateCredit(environment, policy);
  const storeStock = allocateStock(environment, policy);
  const storeSummaries = Object.fromEntries(environment.stores.map((store) => [store.id, {
    name: store.name,
    grossMargin: 0,
    lostSales: 0,
    stockoutUnits: 0,
    creditExposure: 0,
    repaymentRisk: 0,
    demandUnits: 0,
    servedUnits: 0
  }]));

  let grossMargin = 0;
  let lostSales = 0;
  let stockoutUnits = 0;
  let creditExposure = 0;
  let repaymentRisk = 0;
  let demandUnits = 0;
  let servedUnits = 0;
  const daily = [];

  for (let day = 1; day <= environment.horizonDays; day += 1) {
    const upiFailure = shockSeverity(environment, "upi_failure", day, random);
    const rainDelay = shockSeverity(environment, "rain_delay", day, random);
    const competitor = shockSeverity(environment, "competitor_discount", day, random);
    const dayRow = { day, stores: [] };

    for (const store of environment.stores) {
      const routeReliability = environment.distributor.routes?.[store.route]?.reliability ?? 0.9;
      const routePenalty = rainDelay > 0 && store.route === "route-c"
        ? clamp(1 - rainDelay * (1 - policy.routePriority) * (1.2 - routeReliability), 0.58, 1)
        : 1;
      let storeDemand = 0;
      let storeServed = 0;
      let storeLost = 0;
      let storeMargin = 0;

      for (const [sku, product] of Object.entries(environment.products)) {
        const baseRequested = Number(store.requestedUnits?.[sku] ?? product.baseDemand);
        const lift = festivalLift(environment, sku, day, random);
        const noise = 0.86 + random() * 0.32;
        const discountLeak = competitor * (store.trustScore < 0.72 ? 0.28 : 0.12);
        const demand = Math.max(0, Math.round(baseRequested * (1 + lift) * store.footfallIndex * noise * (1 - discountLeak) / 3));
        const upiDemandBlocked = demand * store.upiShare * upiFailure;
        const fallbackRecovered = upiDemandBlocked * policy.upiFallback * store.customerCreditHabit;
        const payableDemand = Math.max(0, demand - upiDemandBlocked + fallbackRecovered);
        const available = Math.floor((storeStock[store.id]?.[sku] ?? 0) * routePenalty);
        const sold = Math.min(available, Math.round(payableDemand));
        const lost = Math.max(0, Math.round(demand - sold));
        storeStock[store.id][sku] = Math.max(0, (storeStock[store.id][sku] ?? 0) - sold);

        storeDemand += demand;
        storeServed += sold;
        storeLost += lost * (product.unitMargin + 42);
        storeMargin += sold * product.unitMargin;
      }

      const creditLine = creditApproved[store.id] ?? 0;
      const creditUsed = Math.min(
        creditLine,
        Math.round((storeMargin * 3.8 + storeLost * 0.18) * (0.18 + policy.creditAggression * 0.32))
      );
      const fallbackCredit = Math.round(storeServed * store.upiShare * upiFailure * policy.upiFallback * 90);
      const exposure = creditUsed + fallbackCredit;
      const riskRate = clamp((1 - store.trustScore) + store.daysLate / 75 + store.customerCreditHabit * 0.22, 0.05, 0.95);
      const risk = exposure * riskRate;

      grossMargin += storeMargin;
      lostSales += storeLost;
      stockoutUnits += Math.max(0, storeDemand - storeServed);
      creditExposure += exposure;
      repaymentRisk += risk;
      demandUnits += storeDemand;
      servedUnits += storeServed;

      const summary = storeSummaries[store.id];
      summary.grossMargin += storeMargin;
      summary.lostSales += storeLost;
      summary.stockoutUnits += Math.max(0, storeDemand - storeServed);
      summary.creditExposure += exposure;
      summary.repaymentRisk += risk;
      summary.demandUnits += storeDemand;
      summary.servedUnits += storeServed;

      dayRow.stores.push({
        store: store.name,
        route: store.route,
        demandUnits: storeDemand,
        servedUnits: storeServed,
        lostSales: Math.round(storeLost),
        grossMargin: Math.round(storeMargin),
        creditExposure: Math.round(exposure),
        repaymentRisk: Math.round(risk)
      });
    }
    daily.push(dayRow);
  }

  const serviceLevel = servedUnits / Math.max(1, demandUnits);
  const opsScore = 1000
    + grossMargin / 90
    - lostSales / 300
    - repaymentRisk / 80
    - creditExposure / 220
    - stockoutUnits / 10
    + serviceLevel * 700;

  return {
    policy: policyKey,
    policyName: policy.name,
    description: policy.description,
    rolloutIndex,
    metrics: {
      grossMargin: Math.round(grossMargin),
      lostSales: Math.round(lostSales),
      stockoutUnits: Math.round(stockoutUnits),
      creditExposure: Math.round(creditExposure),
      repaymentRisk: Math.round(repaymentRisk),
      serviceLevel: Number(serviceLevel.toFixed(3)),
      opsScore: Math.round(opsScore)
    },
    storeSummaries,
    daily
  };
}

export function summarizeScoreboard({ allRollouts, policies = POLICIES }) {
  const scoreboard = Object.keys(policies)
    .map((policyKey) => aggregateRollouts(policyKey, allRollouts.filter((rollout) => rollout.policy === policyKey), policies))
    .sort((a, b) => b.averages.opsScore - a.averages.opsScore);
  return {
    scoreboard,
    wins: winnersByRollout(allRollouts, policies)
  };
}
