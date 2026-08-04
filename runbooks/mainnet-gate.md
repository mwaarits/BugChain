# Mainnet readiness gate (BOT Chain, chain 677)

Testnet must be proven first (`testnet-deploy.md`). This ticket **gates** mainnet: a human signs off before real funds move.

## Deploy (same as testnet, config swap only)

- Network: chain 677, RPC `https://rpc.botchain.ai`, explorer `https://scan.botchain.ai`.
- Redeploy the **same** `BountyEscrow.sol` via Remix (bytecode-identical), constructor `_silenceWindow = 259200`.
- Verify on the explorer with 0.8.24 / optimizer 200 / `259200`.
- Swap env only:

```
RPC_URL=https://rpc.botchain.ai
CONTRACT_ADDRESS=<mainnet address>
VITE_CHAIN_ID=677
VITE_RPC_URL=https://rpc.botchain.ai
VITE_CONTRACT_ADDRESS=<mainnet address>
```

- Post a "killed" check: reject-then-confirm a refund on a dust bounty to prove money moves correctly before anyone funds a real bounty.

## Go / no-go checklist

- [ ] Testnet runbook completed and its smoke test walked a full life (fund → submit → pay / refund / dispute).
- [ ] Mainnet contract deployed + explorer-verified; bytecode matches `abis/BountyEscrow.json` ABI.
- [ ] Admin key stored in a secret manager, **not** in the repo or any env file in git; `ADMIN_TOKEN` is a long random secret.
- [ ] Key rotation plan documented: the admin address is fixed at deploy, so rotation means deploying a fresh contract and moving env; a second (backup) Admin slot is not in v1. Confirm this plan before mainnet funds.
- [ ] `eth_getLogs` / `eth_subscribe` probe result known; indexer is snapshot-based so this only affects the live-feed feature (optional).
- [ ] Free, no platform fees, single winner — confirm no remainder can escape (covered by the contract test suite's balance-in = balance-out invariant).
- [ ] Contract interface is locked — you must NOT upgrade the deployed contract; changes require a fresh deploy + env change.

## Admin-key single-point-of-failure assessment

Current model: one fixed Admin address, owned by the backend (`ADMIN_PRIVATE_KEY` in a secret manager). The contract gates every Admin money touch on `inDispute` and an Admin can only pay an accepted submission's owner or refund the Business — there is no free-withdrawal path, so a compromised key cannot drain escrow wholesale.

Residual risks:

1. **Server compromise** → the attacker can open/close disputes and fabricate+accept a submission, paying themselves. Mitigation if concerns persist: multi-sig (Gnosis Safe) as the Admin address, or a timelock on dispute resolution. Both change the contract's Admin handling and therefore require a new deployment.
2. **Key loss** → disputes freeze forever (no other Admin). Mitigation: an offline backup in a second secret manager, or a second Admin slot in the contract (not present in v1).
3. **Compromised researcher account** → no impact beyond that submitter's report (single-winner, non-custodial).

**Recommendation for v1:** ship with the single-key model (documented, auditable, no free-withdrawal path). Defer multi-sig/timelock to v1.1 with a new deployment unless the Business tier demands extra assurance now. **Human sign-off required here before mainnet funding.**

## Decision record (fill in)

- Signed-off by / date:
- Deployed mainnet address:
- `eth_getLogs` probe result:
- Open items / deferrals: