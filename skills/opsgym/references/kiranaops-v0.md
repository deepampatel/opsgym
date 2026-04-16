# KiranaOps-v0

KiranaOps-v0 tests credit, inventory, payment, and route decisions for Indian kirana/FMCG operations.

Core actors:

- FMCG distributor with finite inventory, route capacity, and credit pool.
- Kirana stores with different demand, repayment quality, UPI exposure, and customer-credit habits.
- Customer market with festival demand, UPI failures, competitor discounts, and rain delays.
- Policy agents that allocate stock and credit under uncertainty.

Default policies:

- `conservative`: protects cash and avoids risky receivables.
- `growth`: maximizes festival sales and accepts higher credit exposure.
- `risk-balanced`: expands credit only for stores with good repayment signals.
- `adaptive-upi-fallback`: pre-positions stock and uses selective credit when UPI reliability drops.

Important causal loops:

- UPI failure reduces payable demand unless the policy/store can absorb customer credit.
- Customer credit preserves sales but increases repayment risk later.
- Rain delay lowers delivered stock on affected routes unless the policy prioritized the route.
- Stockouts reduce realized margin and create demand leakage.
- Blanket credit can win revenue while losing on risk-adjusted score.

The demo should make one recommendation shift visible after a new shock is injected.
