# BanditDex Scoring

Each rollout produces raw arena metrics. The built-in demo adapters use:

- `throughput`: completed work, minutes, cases, orders, or service units.
- `serviceLevel`: served demand divided by total demand.
- `backlog`: unserved demand, uncovered minutes, queues, or late work.
- `operatingCost`: cost of capacity, fallback, overtime, or expedite actions.
- `risk`: domain-specific downside risk such as injury, refunds, or clinical delay.

The default BanditDex score is intentionally transparent and reported as points:

```text
banditScore =
  1000
  + throughput * throughputWeight
  + serviceLevel * 550
  - backlog * backlogWeight
  - operatingCost * costWeight
  - risk * riskWeight
```

Use the score for policy ranking, but report raw metrics too. If a user cares more about growth or risk, rerun with a new scoring function or explain how the ranking would change.
