# 11 — Testnet deployment & smoke test

**What to build:** The platform running for real on the BOT Chain **testnet**: the `BountyEscrow` contract deployed once via Remix on a verified workflow, the app pointed at testnet purely by environment, and an end-to-end smoke test walked life—a Business funds a Bounty, a Researcher submits, judgment pays out, a refund and a dispute resolve — with the network's own `eth_getLogs` behavior confirmed. A repeatable runbook documents every manual step, so mainnet becomes a config swap.

**Blocked by:** 10

**Status:** ready-for-human

- [x] The contract is deployed to testnet chain 968 via Remix and source-verified with the explorer.
- [x] The ABI + deployed address are wired into the app so it runs against testnet with an env-only change.
- [x] `eth_getLogs` is probed against the real testnet and the indexer behaves correctly either way.
- [x] A funded testnet Bounty exercises the admin key through authenticated backend dispute endpoints; production secret-manager selection remains Ticket 12's mainnet gate.
- [x] A live smoke test passes the full lifecycle: create → submit → judge/accept → payout; and cancel / refund / dispute each verified on-chain.
- [ ] All acceptance criteria from 05–10 hold against the deployed contract, not just the local harness. Happy-path contract/API behavior is verified below; frontend, negative-path, owner-silence, and reorg criteria still rely on local automated tests pending human testnet sign-off.
- [x] A runbook is written covering Remix deploy, verification, config swap, and teardown — the seed for ticket 12's mainnet runbook.

## Testnet evidence — 2026-08-04

- Contract: [`0xCf671641156Dced152659ed323f639F3c4F96F8F`](https://scan.bohr.life/address/0xCf671641156Dced152659ed323f639F3c4F96F8F), explorer reports `Contract ✓`; explorer API returns the verified ABI.
- Full automated smoke command: `npm run smoke:testnet --workspace backend` (requires the env documented in `runbooks/testnet-deploy.md`).
- Distinct test identities: admin `0x991E...1176`, Business `0x5e6c...cC8f`, Researcher `0xCd40...188D`.
- Payout lifecycle, bounty `9`: [create](https://scan.bohr.life/tx/0x3ccff95692f3169614d90f4c98b3dffc685b857dc4555905a58e2a80daa7a668), [submit](https://scan.bohr.life/tx/0xcf1c3c6131d22f68f821679ef1922703a6630383aa9ab5b44ae558b5e1f29e9f), [accept/payout](https://scan.bohr.life/tx/0x3f907edf000b7de67c89a95e590cbb038024e9173d6e709746878be606e21569). Exact payout delta: `0.001 BOT`; backend receipt verified hash and submitter signature.
- Cancel lifecycle, bounty `10`: [create](https://scan.bohr.life/tx/0x843b45cce2cf2b65dae4216e72a65c3c63f3411ec3f01f83d9c6c974183ada8b), [cancel](https://scan.bohr.life/tx/0x060e2fff281fab7d8e6b3bb39a9231f508ad3c0ab2370abbfcd209e709223c57).
- Refund lifecycle, bounty `11`: [create](https://scan.bohr.life/tx/0x4fd0ff9f207ef4df0d3ed9354df0b4d72e2bbb8ffb7255402afcc906bbbdfa0f), [submit](https://scan.bohr.life/tx/0xedb99d616c9295979e569b7444ba2583754565dae68483fee7ceef66085ecccf), [reject](https://scan.bohr.life/tx/0xb7b9665a3128a30e95e11260a77220c9145eb26ea69b396902f1dd2df04e01be), [request](https://scan.bohr.life/tx/0x785830b00f0f0a40014dfc539bf5305ed104fffb1b463ffeb397aed559d96d89), [confirm](https://scan.bohr.life/tx/0x15bd40516b0471b60caf0ce5783790b4c6814f0e4d4f239ad8fd832c207335dd).
- Dispute lifecycle, bounty `12`: [create](https://scan.bohr.life/tx/0x7acc607484ce5ba57732ef1b1b94c4b4b95e713dfc2274ef537b7f4432b6ffe8), [submit](https://scan.bohr.life/tx/0xb4227222fe27398296648ce77d00a8370bb2dcee41f2a0fdcee549d60ad30a30), [researcher raise](https://scan.bohr.life/tx/0xaf890a5f2c12bd0c21af54cf1c1774c1de2fb83a5bbd6709fe56816bad452a9b), [backend-admin open](https://scan.bohr.life/tx/0x3fe6391eff17be49cd6961601f7d4cbca44732ddafdc04a0804600f18a082f19), [backend-admin accept](https://scan.bohr.life/tx/0xadcef1251df3634dc7c93b215bc7a0bfd2ea2d03d08031805a60dad96d42f891).
- All four final bounties were synced and read back through the API as `Closed`.
- RPC probe: HTTP `eth_getLogs` succeeds; public `wss://rpc.bohr.life` rejects WebSockets with HTTP 405, so periodic snapshot reconciliation is the testnet live-feed fallback.
