# 10 — Indexer hardening

**What to build:** Make the backend's picture of the chain reliable under real conditions: a live feed keeps it current without waiting for full rescans, replays and dupe events cannot corrupt stored state, and a reorg never leaves stale rows readable. The UI marks unconfirmed state as pending and flips it to confirmed only once blocks are final. `eth_getLogs` is exercised where the network supports it but the system provably works without it.

**Blocked by:** 09

**Status:** ready-for-agent

- [ ] The indexer receives a live feed (WebSocket log subscription) plus periodic snapshot reconcile, keeping current state in sync.
- [ ] Every write is idempotent: replaying events or re-running a snapshot from any point yields the identical database state (upsert on composite PKs, dedupe on event-log unique keys).
- [ ] Each stored row carries a confirmation watermark; the API/UI presents an unconfirmed outcome as `pending`.
- [ ] A block rollback triggers a targeted rescan of only the affected Bounty and self-heals stale rows.
- [ ] `eth_getLogs` is used when the environment supports it as an optional historical backfill and proven harmless when it is unavailable.
- [ ] API tests: replay the same log twice → single visible effect; simulated reorg → state correct after rescan; pending→confirmed transition observable.