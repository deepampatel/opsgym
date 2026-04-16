# BanditDex Run Schema

`run.json` is the stable contract for one tournament execution.

```json
{
  "schemaVersion": "0.2",
  "type": "banditdex-run",
  "runId": "football-rotation-demo",
  "arenaId": "footballops-v0",
  "adapter": {
    "id": "footballops-v0",
    "type": "arena-adapter"
  },
  "question": "Business decision being tested",
  "rollouts": 100,
  "seed": "football-rotation-demo",
  "inputs": {
    "environmentPath": "/abs/path/environment.json"
  },
  "outputs": {
    "runDir": "/abs/path/.banditdex/runs/<run-id>",
    "reportPath": "/abs/path/.banditdex/reports/<run-id>.html",
    "scoresPath": "/abs/path/.banditdex/runs/<run-id>/scores.json",
    "rolloutsPath": "/abs/path/.banditdex/runs/<run-id>/rollouts.json",
    "tracePath": "/abs/path/.banditdex/runs/<run-id>/trace.md"
  },
  "winner": {},
  "scoreboard": [],
  "wins": {}
}
```

Agent tournaments extend this same contract with:

```json
{
  "mode": "agent-tournament",
  "agentSource": "openai",
  "agentModel": "gpt-4.1-mini",
  "agentPlans": []
}
```

The run directory should also include `agents.json`, which records the generated agent theses and simulator parameters used for scoring.

When the skill runs inside Codex, Codex may write the input agent plans first and pass them with `--agents-file`. The runner should mark these runs with `agentSource: "codex-file"` so they are distinguishable from standalone OpenAI API generation.

The run contract should be written before or alongside report artifacts so downstream comparison/report tooling has one canonical place to read execution metadata.
