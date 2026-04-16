# OpsGym Comparison Schema

`comparison.json` is the stable contract for comparing two tournament runs.

```json
{
  "schemaVersion": "0.2",
  "type": "opsgym-comparison",
  "comparisonId": "baseline-vs-upi-shock",
  "arenaId": "kiranaops-v0",
  "adapter": {
    "id": "kiranaops-v0",
    "type": "arena-adapter"
  },
  "baselineRunId": "arena-first-baseline",
  "candidateRunId": "arena-first-upi-shock",
  "baselineWinner": {},
  "candidateWinner": {},
  "summary": {
    "winnerChanged": true,
    "why": "UPI failure increases value of payment-fallback policies."
  }
}
```

Comparison tooling should not infer everything from report HTML. It should read the two `run.json` files and emit one structured comparison artifact.
