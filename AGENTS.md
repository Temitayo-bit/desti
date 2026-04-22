# AGENTS

## Continuous Learning & Code Review Rules

- Treat any accept/confirm action that consumes seats as a single transaction: conditionally decrement seats, create booking, then transition the source record state. Never split these writes across separate transactions.
- Guard every state transition with `updateMany` (or equivalent) filtered by the expected current state to prevent silent reopening or double-accept races.
- Keep pending negotiation records capacity-neutral. Inventory is checked only at the terminal accept step.
- When a conditional write returns `count = 0`, re-read canonical records in-transaction and map to specific conflict reasons (inactive, departed, full, forbidden) instead of returning generic failures.
- Validate deterministic primitives at both route and service boundaries for money and coordinates: positive int32 for prices, finite lat/lng ranges, and trimmed non-empty text.
- Enforce authorization on both the child record and its parent ownership context before mutation to avoid denormalized ownership drift issues.
- For list/read endpoints, bind query scope directly to the authenticated actor and verify parent ownership before returning any nested records.
- Preserve coexistence invariants across parallel booking paths by routing all seat competition through the same conditional seat-decrement primitive.
