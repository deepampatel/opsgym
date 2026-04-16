import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { slug } from "./workspace.mjs";

export const AGENT_SCHEMA = {
  type: "object",
  properties: {
    agents: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          thesis: { type: "string" },
          parameters: {
            type: "object",
            properties: {
              capacityAggression: { type: "number" },
              riskTolerance: { type: "number" },
              executionAggression: { type: "number" },
              fallbackRecovery: { type: "number" },
              priorityFocus: { type: "number" }
            },
            required: ["capacityAggression", "riskTolerance", "executionAggression", "fallbackRecovery", "priorityFocus"],
            additionalProperties: false
          }
        },
        required: ["id", "name", "thesis", "parameters"],
        additionalProperties: false
      }
    }
  },
  required: ["agents"],
  additionalProperties: false
};

export const PARAMETER_DESCRIPTIONS = [
  ["capacityAggression", "how much scarce capacity or budget to deploy, 0.05 to 1"],
  ["riskTolerance", "willingness to accept downside risk, 0.05 to 1"],
  ["executionAggression", "how aggressively to pursue throughput or performance, 0.4 to 1.15"],
  ["fallbackRecovery", "ability to recover missed demand through fallback options, 0 to 1"],
  ["priorityFocus", "attention to high-priority entities and disrupted paths, 0 to 1"]
];

export const PARAMETER_RANGES = {
  capacityAggression: [0.05, 1],
  riskTolerance: [0.05, 1],
  executionAggression: [0.4, 1.15],
  fallbackRecovery: [0, 1],
  priorityFocus: [0, 1]
};

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}

export function clampInteger(value, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.min(max, parsed));
}

export function clampParameters(parameters) {
  return {
    capacityAggression: clamp(parameters.capacityAggression, ...PARAMETER_RANGES.capacityAggression),
    riskTolerance: clamp(parameters.riskTolerance, ...PARAMETER_RANGES.riskTolerance),
    executionAggression: clamp(parameters.executionAggression, ...PARAMETER_RANGES.executionAggression),
    fallbackRecovery: clamp(parameters.fallbackRecovery, ...PARAMETER_RANGES.fallbackRecovery),
    priorityFocus: clamp(parameters.priorityFocus, ...PARAMETER_RANGES.priorityFocus)
  };
}

export function environmentBrief(environment) {
  return {
    question: environment.question,
    horizonDays: environment.horizonDays,
    shocks: environment.shocks,
    metrics: environment.metrics,
    resources: environment.resources,
    entities: environment.simulationEntities || environment.entities
  };
}

export async function readAgentPlansFile(path, count) {
  const payload = JSON.parse(await readFile(resolve(path), "utf8"));
  const plans = Array.isArray(payload) ? payload : payload.agents;
  if (!Array.isArray(plans)) {
    throw new Error("--agents-file must contain an array or an object with an agents array.");
  }
  return plans.slice(0, count);
}

function isPlaceholder(text) {
  return /replace this|codex agent \d+|distinct decision thesis/i.test(String(text || ""));
}

function parameterSignature(parameters = {}) {
  return Object.keys(PARAMETER_RANGES)
    .map((key) => `${key}:${Number(parameters[key]).toFixed(3)}`)
    .join("|");
}

export function validateAgentPlans(plans, { strict = true } = {}) {
  const errors = [];
  const warnings = [];

  if (!Array.isArray(plans)) {
    return { ok: false, errors: ["Agent plan payload must be an array."], warnings };
  }
  if (plans.length < 1) errors.push("At least one agent is required.");
  if (plans.length > 6) errors.push("At most six agents are allowed.");

  const ids = new Set();
  const names = new Set();
  const signatures = new Map();

  plans.forEach((agent, index) => {
    const label = `agents[${index}]`;
    if (!agent || typeof agent !== "object" || Array.isArray(agent)) {
      errors.push(`${label} must be an object.`);
      return;
    }

    for (const field of ["id", "name", "thesis"]) {
      if (typeof agent[field] !== "string" || !agent[field].trim()) errors.push(`${label}.${field} must be a non-empty string.`);
    }
    if (strict && (isPlaceholder(agent.name) || isPlaceholder(agent.thesis))) {
      errors.push(`${label} still looks like a template placeholder.`);
    }

    const id = slug(agent.id || "");
    if (id) {
      if (ids.has(id)) errors.push(`${label}.id duplicates another agent id: ${id}.`);
      ids.add(id);
    }
    const name = String(agent.name || "").trim().toLowerCase();
    if (name) {
      if (names.has(name)) warnings.push(`${label}.name duplicates another agent name: ${agent.name}.`);
      names.add(name);
    }

    if (!agent.parameters || typeof agent.parameters !== "object" || Array.isArray(agent.parameters)) {
      errors.push(`${label}.parameters must be an object.`);
      return;
    }

    for (const [key, [min, max]] of Object.entries(PARAMETER_RANGES)) {
      const value = Number(agent.parameters[key]);
      if (!Number.isFinite(value)) {
        errors.push(`${label}.parameters.${key} must be a finite number.`);
      } else if (value < min || value > max) {
        errors.push(`${label}.parameters.${key} must be between ${min} and ${max}; got ${value}.`);
      }
    }

    if (Object.keys(PARAMETER_RANGES).every((key) => Number.isFinite(Number(agent.parameters[key])))) {
      const signature = parameterSignature(agent.parameters);
      const previous = signatures.get(signature);
      if (previous !== undefined) {
        const message = `${label}.parameters are identical to agents[${previous}].`;
        if (strict) errors.push(message);
        else warnings.push(message);
      }
      signatures.set(signature, index);
    }
  });

  return { ok: errors.length === 0, errors, warnings };
}

export function assertValidAgentPlans(plans, options) {
  const result = validateAgentPlans(plans, options);
  if (!result.ok) {
    const details = result.errors.map((error) => `- ${error}`).join("\n");
    throw new Error(`Invalid agent plan file:\n${details}`);
  }
  return result;
}

export function normalizePlans(plans, source, model) {
  return plans.map((plan, index) => {
    const id = slug(plan.id || plan.name || `agent-${index + 1}`) || `agent-${index + 1}`;
    return {
      id,
      name: plan.name || id,
      description: plan.thesis || "LLM-generated decision agent.",
      source,
      model,
      parameters: clampParameters(plan.parameters || {})
    };
  });
}

export function toPolicyMap(agentPlans) {
  return Object.fromEntries(agentPlans.map((agent) => [agent.id, {
    name: agent.name,
    description: agent.description,
    source: agent.source,
    model: agent.model,
    ...agent.parameters
  }]));
}
