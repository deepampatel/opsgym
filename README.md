# OpsGym

OpsGym is a Codex-native skill/plugin for building operational simulation arenas where decision agents compete before decisions touch reality.

The repo root is the OpsGym plugin:

```text
.codex-plugin/plugin.json
opsgym
skills/opsgym/
  SKILL.md
  arenas/
  scripts/
  references/
```

Generated simulation workspaces live outside the skill code under `.ops-gym/` in the active project and are ignored by Git.

## What It Does

OpsGym turns a messy operational question into a runnable arena:

1. Draft an arena from the situation.
2. Confirm the arena before execution.
3. Materialize an environment.
4. Create decision agents or use baseline policies.
5. Run repeated stochastic rollouts.
6. Score the agents.
7. Write reports, run contracts, scorecards, and decision memos.

The key design principle is separation:

- **Codex designs agents and interprets results.**
- **Adapters define domain simulation rules.**
- **The OpsGym runner scores policies and agents deterministically.**

## Current Features

- Codex skill: `skills/opsgym/SKILL.md`
- CLI wrapper: `./opsgym`
- Arena state machine: `init`, `status`, `next`, `loop`
- Arena lifecycle: `setup`, `confirm`, `env`
- Baseline policy tournaments: `run`
- Codex-authored agent workflow: `agent-brief`, `agent-validate`, `agent-run`
- Standalone OpenAI API agent generation for non-Codex automation
- Shock injection: `shock`
- Run comparison: `compare`
- Doctor checks: `doctor`
- HTML reports, JSON contracts, scorecards, rollouts, and decision memos
- Adapter interface for adding new executable domains

## Built-In Runnable Arenas

OpsGym currently ships three executable adapters:

- `footballops-v0`: fixture congestion, player minutes, rotation, pressing intensity, injury risk
- `deliveryops-v0`: rider allocation, SLA pressure, rain shocks, surge demand, refund risk
- `hospitalops-v0`: bed allocation, triage queues, staff fatigue, emergency surge, elective deferral

List installed arenas:

```bash
./opsgym list
```

## Quick Start

Run a policy tournament:

```bash
./opsgym setup \
  --arena deliveryops-v0 \
  --question "Should the marketplace accept surge demand during rain or protect delivery SLA?" \
  --confirm

./opsgym run \
  --arena deliveryops-v0 \
  --run delivery-demo \
  --rollouts 50
```

Run a Codex-authored agent tournament:

```bash
./opsgym setup \
  --arena footballops-v0 \
  --question "Should the club rotate heavily or push starters through fixture congestion?" \
  --confirm

./opsgym agent-brief \
  --arena footballops-v0 \
  --run football-agents \
  --agents 4
```

Then ask Codex to read `.ops-gym/agent-plans/football-agents.brief.md`, write `.ops-gym/agent-plans/football-agents.json`, and run:

```bash
./opsgym agent-validate \
  --file .ops-gym/agent-plans/football-agents.json

./opsgym agent-run \
  --arena footballops-v0 \
  --run football-agents \
  --agents-file .ops-gym/agent-plans/football-agents.json \
  --rollouts 50
```

## Demo Prompts

```text
Use $opsgym. Run deliveryops-v0. Should the marketplace accept surge demand during rain or protect delivery SLA? Create Codex-authored agents, validate them, run 50 rollouts, and explain the winning strategy.
```

```text
Use $opsgym. Run hospitalops-v0. Should the hospital defer elective work to protect emergency capacity during a surge? Create Codex-authored agents, validate them, run 50 rollouts, and report the clinical-risk tradeoff.
```

```text
Use $opsgym. Run footballops-v0. Should the club rotate heavily or push starters through fixture congestion? Create Codex-authored agents, validate them, run 50 rollouts, and explain the injury-risk tradeoff.
```

```text
Use $opsgym. Run footballops-v0. Add a midweek cup congestion shock, rerun the agent tournament, and compare whether the winning rotation strategy changes.
```

## Agentic Model

Inside Codex, the best path is:

1. OpsGym creates an arena brief.
2. Codex designs multiple distinct agents from that brief.
3. OpsGym validates the agent JSON.
4. OpsGym runs the agents through repeated rollouts.
5. Codex interprets the scorecard and writes the recommendation.

Today, the packaged runner executes rollouts sequentially in-process. The work is naturally parallelizable across agents and rollout indexes, so the next scaling upgrade is a `--jobs <n>` worker-pool runner.

## Adding A New Arena

Create:

```text
skills/opsgym/arenas/<arena-id>/adapter.mjs
```

The adapter must export:

- `adapterMeta`
- `buildDraftArena`
- `materializeEnvironment`
- `listPolicies`
- `runPolicy`
- `summarizeScoreboard`

Read `skills/opsgym/references/adapter-interface.md` before adding a domain.

## Validation

```bash
./opsgym doctor --skip-smoke
python3 /Users/deepampatel/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/opsgym
```
