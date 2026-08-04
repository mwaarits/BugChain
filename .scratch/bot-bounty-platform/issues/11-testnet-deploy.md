# 11 — Testnet deployment & smoke test

**What to build:** The platform running for real on the BOT Chain **testnet**: the `BountyEscrow` contract deployed once via Remix on a verified workflow, the app pointed at testnet purely by environment, and an end-to-end smoke test walked life—a Business funds a Bounty, a Researcher submits, judgment pays out, a refund and a dispute resolve — with the network's own `eth_getLogs` behavior confirmed. A repeatable runbook documents every manual step, so mainnet becomes a config swap.

**Blocked by:** 10

**Status:** ready-for-agent

- [ ] The contract is deployed to testnet chain 968 via Remix and source-verified with the explorer.
- [ ] The ABI + deployed address are wired into the app so it runs against testnet with an env-only change.
- [ ] `eth_getLogs` is probed against the real testnet and the indexer behaves correctly either way.
- [ ] A funded testnet Bounty lets the admin key live in the backend secret manager for the dispute endpoints.
- [ ] A live smoke test passes the full lifecycle: create → submit → judge/accept → payout; and cancel / refund / dispute each verified on-chain.
- [ ] Acceptance criteria from 05–10 hold against the deployed contract, not just the local harness.
- [ ] A runbook is written covering Remix deploy, verification, config swap, and teardown — the seed for ticket 12's mainnet runbook.