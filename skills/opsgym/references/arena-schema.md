# OpsGym Arena Schema

`arena.json` is the durable source of truth for one gym. Users review and confirm this draft before OpsGym materializes an executable environment.

Required top-level fields:

```json
{
  "schemaVersion": "0.2",
  "arenaId": "kiranaops-v0",
  "arenaName": "KiranaOps-v0",
  "adapter": {
    "id": "kiranaops-v0",
    "type": "arena-adapter",
    "version": "0.1",
    "domain": "retail-ops"
  },
  "status": "draft",
  "question": "Business decision being tested",
  "setupMode": "fast",
  "horizonDays": 7,
  "actors": [],
  "actions": [],
  "constraints": [],
  "policies": [],
  "shocks": [],
  "metrics": {},
  "products": {},
  "distributor": {},
  "stores": [],
  "sources": {}
}
```

Key rules:

- `status` must be `confirmed` before standard runs.
- `adapter` identifies the domain implementation that the generic core should load.
- `actors`, `actions`, `constraints`, and `policies` are the human-reviewable navigation layer.
- `products`, `distributor`, `stores`, and `shocks` are the executable world state.
- `confirmedAt` is written when the arena is approved.
- Changes to the world should update the arena first. Environments are derived artifacts.
