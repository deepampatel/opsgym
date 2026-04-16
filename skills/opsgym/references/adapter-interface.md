# OpsGym Adapter Interface

OpsGym should stay generic. Domain behavior lives in arena adapters.

Adapter location convention:

```text
plugins/opsgym/skills/opsgym/arenas/<adapter-id>/adapter.mjs
```

Each adapter should export:

```js
export const adapterMeta = {
  id: "kiranaops-v0",
  version: "0.1",
  domain: "retail-ops"
};

export async function buildDraftArena(input) {}
export function materializeEnvironment(arenaSpec) {}
export function listPolicies(arenaSpec) {}
export function runPolicy(environment, policyKey, rolloutIndex, seed) {}
export function summarizeScoreboard(environment, rollouts) {}
```

Required responsibilities:

- `buildDraftArena(input)`: turn user intent and source files into a draft `arena.json`
- `materializeEnvironment(arenaSpec)`: derive executable `environment.json`
- `listPolicies(arenaSpec)`: expose the policies valid for this arena
- `runPolicy(...)`: execute one policy for one rollout and return metrics
- `summarizeScoreboard(...)`: aggregate rollouts into report-ready outputs

The generic OpsGym core should manage:

- workspace layout
- draft/confirm flow
- run orchestration
- comparison orchestration
- generic reporting shell

The adapter should manage:

- domain actors
- domain actions
- transition logic
- domain shocks
- policy semantics
- domain scoring details
