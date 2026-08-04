# 12 — Mainnet readiness gate

**What to build:** Everything a small team needs to make the go-live decision and execute against mainnet without a dedicated agent run: a verified mainnet runbook derived from the testnet one (chain 677, RPC, explorer, redeploy-the-same-contract), a go/no-go checklist, and — the gating review — a documented assessment of the admin-key model, the known single-point-of-failure limitation flagged in the spec. The ticket prepares and gates mainnet; a human signs off before any real funds move.

**Blocked by:** 11

**Status:** ready-for-agent

- [ ] A mainnet runbook (env, RPC chain 677, contract redeploy + verify, ABI bump) is produced from the tested testnet runbook — reproducible, no unplanned steps.
- [ ] A go/no-go checklist covers: admin-key secret management, key rotation plan, `eth_getLogs` status, fees/zero-winner invariants, and the contract interface lock.
- [ ] The admin-key single-point-of-failure risk is assessed in writing, including whether any mitigation (multi-sig, timelock, committee) is warranted now or deferred.
- [ ] The readiness risk findings are assigned to and the checklist completed, publishing the decision.
- [ ] The mainnet deploy itself is explicitly left to a human gate, not executed by this ticket.