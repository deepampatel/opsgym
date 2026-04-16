# OpsGym Environment Schema

`environment.json` is the executable snapshot derived from a confirmed `arena.json`.

Required top-level fields:

```json
{
  "schemaVersion": "0.2",
  "arena": "FootballOps-v0",
  "adapter": {
    "id": "footballops-v0",
    "type": "arena-adapter"
  },
  "question": "Business decision being tested",
  "horizonDays": 7,
  "createdAt": "ISO timestamp",
  "entities": [],
  "simulationEntities": [],
  "resources": {},
  "dynamics": {},
  "shocks": [],
  "metrics": {},
  "sources": {}
}
```

Entity fields:

- `id`: stable kebab-case id.
- `name`: display name.
- `label`: human-readable segment or role.
- `demand`: baseline demand, minutes, cases, orders, or work units.
- `fragility`: `0..1`; how strongly shocks harm this entity.
- `priority`: `0..1`; how important the entity is to the objective.
- `reliability`: `0..1`; how resilient the entity is under pressure.

Shock fields:

- `id`: stable id.
- `type`: domain-native shock type, such as `fixture_congestion`, `opponent_pressure`, `rain_delay`, or `arrival_surge`.
- `label`: human-readable label.
- `day`: simulated day number.
- `severity`: `0..1`.
- Optional type-specific metadata is allowed when an adapter uses it.

Generated runs must not modify prior run artifacts. Create a new run id for each tournament.
