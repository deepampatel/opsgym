# BanditDex

**Let the best strategy win. Every time.**

BanditDex is a Codex skill that turns a business question into a simulation, lets AI agents compete with different strategies, and tells you which one wins — backed by data, not gut feel.

```text
question → arena → agents compete → scorecard → recommendation
```

## Why BanditDex

Every business makes high-stakes operational calls every day:

- Should we accept surge demand during rain, or protect SLA?
- Should the hospital defer elective work when the ER is flooded?
- Should the club rotate players through a packed fixture schedule?

Most teams answer these with gut feel or a spreadsheet. BanditDex answers them with evidence — by running hundreds of simulated trials with competing strategies, under realistic shocks, before anything touches production.

## 30-Second Demo

```bash
git clone https://github.com/deepampatel/banditdex.git
cd banditdex
chmod +x banditdex
./banditdex showcase
```

That's it. The showcase command:

1. Drafts a simulation arena from a business question
2. Runs a baseline policy tournament (100 rollouts)
3. Pits 4 AI agents against each other with different strategies
4. Compares baseline vs agents
5. Generates three HTML reports

Try a different domain:

```bash
./banditdex showcase --arena deliveryops-v0
./banditdex showcase --arena hospitalops-v0
```

## Install

Requires Node.js 18+. No `npm install` — zero external dependencies.

```bash
git clone https://github.com/deepampatel/banditdex.git
cd banditdex
chmod +x banditdex
./banditdex doctor
```

`doctor` validates Node, CLI syntax, skill metadata, all installed adapters, and runs a 5-rollout smoke test.

## Use Inside Codex

This is where BanditDex shines. Paste one prompt into Codex:

```text
Use $banditdex. Should the club rotate heavily or push starters
through fixture congestion? Draft the arena, create 4 distinct
agents, run 100 rollouts, and explain which strategy wins.
```

Codex reads the environment brief, designs agents with meaningfully different strategies, validates them, runs the tournament, and interprets the scorecard — all from one prompt.

## How It Works

```text
┌─────────────────────────────────────────────────┐
│  Codex / LLM                                    │
│  Designs agents. Interprets scorecards.         │
│  Writes recommendation narratives.              │
├─────────────────────────────────────────────────┤
│  BanditDex Core                                 │
│  State machine. Validation. Tournament runner.  │
│  Scoring. Reports. Contracts.                   │
├─────────────────────────────────────────────────┤
│  Adapters                                       │
│  Domain logic: actors, shocks, transitions,     │
│  policies, entity simulation, scoring weights.  │
└─────────────────────────────────────────────────┘
```

**Codex** owns agent design and result interpretation — it reads a brief, creates strategy hypotheses, and explains outcomes.

**Core** owns orchestration — state machine, validation, deterministic rollouts, scoring, and report generation.

**Adapters** own domain logic — each adapter defines the simulation rules for one operational world.

The core engine is domain-agnostic. Everything self-aligns to whatever adapter is installed.

## Built-In Arenas

| Adapter | Domain | Sample question |
|---------|--------|-----------------|
| `footballops-v0` | Sports | Rotate vs push starters through fixture congestion |
| `deliveryops-v0` | Delivery | Accept surge during rain vs protect SLA |
| `hospitalops-v0` | Hospital | Defer elective work vs protect emergency capacity |

List what's installed:

```bash
./banditdex list
```

## The Agent Loop

Inside Codex, the flow is:

1. BanditDex writes an agent brief from the confirmed environment.
2. Codex reads the brief and designs 2-6 distinct agents with different strategy theses.
3. BanditDex validates the agent JSON against a strict schema.
4. BanditDex runs the agents through 100+ stochastic rollouts with seeded randomness.
5. Codex reads the scorecard and writes the recommendation narrative.

Each agent is encoded as 5 numeric parameters:

- `capacityAggression` — how much scarce capacity or budget to deploy
- `riskTolerance` — willingness to accept downside risk
- `executionAggression` — how aggressively to pursue throughput or performance
- `fallbackRecovery` — ability to recover missed demand through fallback options
- `priorityFocus` — attention to high-priority entities and disrupted paths

This parameter contract is universal — it works for any domain.

## Demo Prompts

```text
Use $banditdex. Run deliveryops-v0. Should the marketplace accept surge demand
during rain or protect delivery SLA? Create 4 agents, run 50 rollouts, and
explain the winning strategy.
```

```text
Use $banditdex. Run hospitalops-v0. Should the hospital defer elective work
to protect emergency capacity during a surge? Run the agent tournament and
report the clinical-risk tradeoff.
```

```text
Use $banditdex. Run footballops-v0. Add a midweek cup congestion shock, rerun
the agent tournament, and compare whether the winning rotation strategy changes.
```

## CLI Reference

```bash
./banditdex showcase [--arena <id>]           # Full pipeline demo
./banditdex setup --arena <id>                # Draft an arena
./banditdex confirm --arena <id>              # Confirm a draft
./banditdex env --arena <id>                  # Materialize environment
./banditdex run --arena <id> --rollouts 100   # Baseline policy tournament
./banditdex agent-brief --arena <id>          # Generate agent design brief
./banditdex agent-validate --file <path>      # Validate agent JSON
./banditdex agent-run --arena <id>            # Run agent tournament
./banditdex shock --arena <id> --type <t> --day <n> --severity <s>
./banditdex compare --baseline <id> --candidate <id>
./banditdex list                              # Show installed adapters
./banditdex status                            # Current workspace state
./banditdex doctor                            # Health check
```

## Add a New Domain

Create `skills/banditdex/arenas/<arena-id>/adapter.mjs` exporting:

| Export | Purpose |
|--------|---------|
| `adapterMeta` | id, version, domain |
| `buildDraftArena` | Structure the question into an arena spec |
| `materializeEnvironment` | Derive an executable environment from the arena |
| `listPolicies` | Baseline strategies to compete |
| `runPolicy` | Simulate one policy for one rollout, return metrics |
| `summarizeScoreboard` | Aggregate rollouts into a leaderboard |

See `references/adapter-interface.md` for the full contract.

The CLI, agent workflow, reports, and showcase all auto-align to the new adapter. No config needed.

## Repo Layout

```text
.codex-plugin/plugin.json          # Codex plugin manifest
banditdex                          # CLI entry point
skills/banditdex/
  SKILL.md                         # Codex skill definition
  arenas/                          # Domain adapters (add more here)
    footballops-v0/adapter.mjs
    deliveryops-v0/adapter.mjs
    hospitalops-v0/adapter.mjs
  scripts/                         # Core engine + orchestration
  references/                      # Schema docs + contracts

.banditdex/                        # Generated workspace (git-ignored)
  arenas/       → arena.json, summary
  environments/ → environment.json
  runs/         → run.json, rollouts, scores, memos
  reports/      → HTML dashboards
  comparisons/  → baseline-vs-candidate analysis
```

## Validation

```bash
./banditdex doctor
```

Runs all checks: Node version, CLI syntax, skill metadata, every installed adapter, script syntax, and a 5-rollout smoke test.

## Philosophy

BanditDex treats every operational decision as a multi-armed bandit problem — each strategy is a bandit, and the simulation tells you which one pays off. The twist: the bandits aren't hardcoded. Codex designs them from the environment. The skill adapts to any domain.

Let the best bandit win.
