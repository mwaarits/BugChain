# 10 — Indexer hardening

**What to build:** Make the backend's picture of the chain reliable under real conditions: a live feed keeps it current without waiting for full rescans, replays and dupe events cannot corrupt stored state, and a reorg never leaves stale rows readable. The UI marks unconfirmed state as pending and flips it to confirmed only once blocks are final. `eth_getLogs` is exercised where the network supports it but the system provably works without it.

**Blocked by:** 09

**Status:** ready-for-human

Testnet probe (2026-08-04): `eth_getLogs` succeeds over `https://rpc.bohr.life`; public `wss://rpc.bohr.life` rejects the WebSocket handshake with HTTP 405. Live sync is implemented and covered against local Hardhat WebSockets, while production safely uses periodic snapshot reconcile until a WebSocket provider is configured.

- [x] The indexer receives a live feed (WebSocket log subscription) plus periodic snapshot reconcile, keeping current state in sync.
- [x] Every write is idempotent: replaying events or re-running a snapshot from any point yields the identical database state (upsert on composite PKs; event notifications trigger canonical snapshot reads).
- [x] Each stored row carries a confirmation watermark; the API/UI presents an unconfirmed outcome as `pending`.
- [x] A block rollback triggers a targeted rescan or periodic snapshot reconciliation and self-heals stale rows.
- [x] `eth_getLogs` is probed when WebSocket sync starts and proven harmless when unavailable because polling remains active.
- [x] API tests: repeated snapshots → single visible effect; actual local-chain snapshot/revert → state correct after reconcile; live event → visible without manual sync; pending→confirmed transition observable.
