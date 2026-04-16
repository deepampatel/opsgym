# OpsGym State Machine

OpsGym should advance through explicit project states. Codex can orchestrate the workflow, but durable files must define what happens next.

## Session Contract

`opsgym.json` lives at the project root and captures the user's intent:

```json
{
  "project": "holiday-demand-demo",
  "arenaId": "footballops-v0",
  "domain": "sports-ops",
  "question": "Decision being tested",
  "workspace": ".ops-gym",
  "rollouts": 100,
  "seed": 42,
  "mode": "guided"
}
```

Keep this file concise. It should not duplicate full arena, environment, run, or report artifacts.

## Progress Journal

`.ops-gym/progress.md` is append-only project memory. Record phase transitions and human decisions:

```text
- initialized session
- drafted arena footballops-v0
- user confirmed arena
- materialized environment
- ran baseline tournament
- added fixture congestion shock
- compared baseline vs shock
```

## Commands

- `init`: create or update `opsgym.json`.
- `list`: show installed executable adapters; also mention suggested domains that need adapters before simulation.
- `status`: report current project state and the next safe action.
- `next`: perform exactly one safe phase based on files on disk.
- `loop`: repeat `next` until done, blocked, or waiting for confirmation.
- `compare`: read two `run.json` contracts and write `comparisons/<id>/comparison.json`.
- `doctor`: run environment and smoke checks before demos or packaging.
- `agent-brief`: write a compact arena brief for Codex-authored agent planning.
- `agent-validate`: validate Codex-authored agent plans before scoring.
- `agent-run`: generate decision agents with an LLM, convert their plans into arena policy parameters, run rollouts, and write agent artifacts.

`loop` must stop when an arena is still draft unless the user has explicitly allowed unattended confirmation.

## Phase Rules

1. No `opsgym.json`: initialize the session.
2. No `arena.json`: draft the arena.
3. Draft arena: show `arena-summary.md` and request confirmation.
4. Confirmed arena without environment: create `environment.json`.
5. Environment without run: run a baseline tournament, or use `agent-run` when the goal is agent evaluation.
6. Multiple runs or baseline plus shock: compare and report.

Scripted policies are baseline controls. Agent tournaments are the intended interactive path once an arena can execute.

## Adapter Rule

The core can design arenas for new domains, but executable simulation requires an adapter. If no adapter exists, say so plainly and offer to scaffold one. Do not run a different adapter as a substitute for the user's domain.
