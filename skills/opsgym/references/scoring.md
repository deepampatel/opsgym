# OpsGym Scoring

Each rollout produces raw business metrics:

- `grossMargin`: rupees of realized product margin.
- `lostSales`: rupees of unmet demand.
- `stockoutUnits`: unmet product units.
- `creditExposure`: rupees added to distributor/customer credit.
- `repaymentRisk`: risk-adjusted receivable exposure.
- `serviceLevel`: served demand divided by total demand.

The default OpsGym score is intentionally transparent and reported as points:

```text
opsScore =
  1000
  + grossMargin / 90
  - lostSales / 300
  - repaymentRisk / 80
  - creditExposure / 220
  - stockoutUnits / 10
  + serviceLevel * 700
```

Use the score for policy ranking, but report raw metrics too. If a user cares more about growth or risk, rerun with a new scoring function or explain how the ranking would change.
