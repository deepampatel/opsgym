# BanditDex Comparison Schema

`comparison.json` is the stable contract for comparing two tournament runs.

```json
{
  "schemaVersion": "0.2",
  "type": "banditdex-comparison",
  "comparisonId": "baseline-vs-fixture-shock",
  "arenaId": "footballops-v0",
  "adapter": {
    "id": "footballops-v0",
    "type": "arena-adapter"
  },
  "baselineRunId": "arena-first-baseline",
  "candidateRunId": "arena-first-fixture-shock",
  "baselineWinner": {},
  "candidateWinner": {},
  "summary": {
    "winnerChanged": true,
    "why": "Fixture congestion increases the value of rotation and injury-risk protection."
  }
}
```

Comparison tooling should not infer everything from report HTML. It should read the two `run.json` files and emit one structured comparison artifact.
