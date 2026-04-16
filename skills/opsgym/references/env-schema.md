# OpsGym Environment Schema

`environment.json` is the executable snapshot derived from a confirmed `arena.json`.

Required top-level fields:

```json
{
  "schemaVersion": "0.2",
  "arena": "KiranaOps-v0",
  "adapter": {
    "id": "kiranaops-v0",
    "type": "arena-adapter"
  },
  "question": "Business decision being tested",
  "horizonDays": 7,
  "createdAt": "ISO timestamp",
  "stores": [],
  "products": {},
  "distributor": {},
  "shocks": [],
  "metrics": {},
  "sources": {}
}
```

Store fields:

- `id`: stable kebab-case id.
- `name`: display name.
- `segment`: store type or local market segment.
- `trustScore`: `0..1`; higher means better repayment and relationship quality.
- `upiShare`: `0..1`; share of demand exposed to UPI failures.
- `customerCreditHabit`: `0..1`; tendency to move failed purchases into credit books.
- `footfallIndex`: positive demand multiplier.
- `cashReserve`: available cash buffer in INR.
- `creditLimit`: distributor credit limit in INR.
- `outstanding`: current distributor receivable in INR.
- `daysLate`: current repayment delay.
- `route`: delivery route id.
- `requestedUnits`: SKU demand/request map.

Shock fields:

- `id`: stable id.
- `type`: one of `festival_demand`, `upi_failure`, `rain_delay`, `competitor_discount`, `supplier_shortfall`.
- `label`: human-readable label.
- `day`: simulated day number.
- `severity`: `0..1`.
- Optional type-specific metadata such as `skuLift`, `affectedRoutes`, or `hours`.

Generated runs must not modify prior run artifacts. Create a new run id for each tournament.
