# 12 — Mainnet readiness gate

**What to build:** Everything a small team needs to make the go-live decision and execute against mainnet without a dedicated agent run: a verified mainnet runbook derived from the testnet one (chain 677, RPC, explorer, redeploy-the-same-contract), a go/no-go checklist, and — the gating review — a documented assessment of the admin-key model, the known single-point-of-failure limitation flagged in the spec. The ticket prepares and gates mainnet; a human signs off before any real funds move.

**Blocked by:** 11

**Status:** ready-for-agent

- [x] A mainnet runbook (env, RPC chain 677, contract redeploy + verify, ABI bump) is produced from the tested testnet runbook — reproducible, no unplanned steps.
- [x] A go/no-go checklist covers: admin-key secret management, key rotation plan, `eth_getLogs` status, fees/zero-winner invariants, and the contract interface lock.
- [x] The admin-key single-point-of-failure risk is assessed in writing, including whether any mitigation (multi-sig, timelock, committee) is warranted now or deferred. **2026-08-04 decision (contract finalize): deferred** — trusted-operator model retained; re-review before mainnet deploy. `transferAdmin` exists, so a later multi-sig/timelock can be wired as the admin address without a testnet redeploy. This ticket must decide before mainnet deploys (mainnet deploy is a separate human-gated event).
- [ ] The readiness risk findings are assigned to and the checklist completed, publishing the decision.
- [x] The mainnet deploy itself is explicitly left to a human gate, not executed by this ticket.

**Deployment record (2026-08-04, human-gated event):**
- Mainnet contract deployed: `0x457faf41371fEeAFca510BDF3073A6d5cc176A7F` (chain 677), admin = deployer `0xc929Ee9Ec6Df1e24964A1f047C136c614B4e4e01`
- Explorer-verified `BountyEscrow` 0.8.24 / optimizer on; on-chain params `silenceWindow`=259200, `raiseCooldown`=86400, `bountyCount`=0
- Remaining before real funding: dust "killed" refund check on mainnet, production backend/frontend env swap via secret manager, human sign-off