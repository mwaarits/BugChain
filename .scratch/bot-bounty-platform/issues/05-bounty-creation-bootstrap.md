# 05 — Bounty creation & project bootstrap

**What to build:** From a blank checkout, a runnable three-unit system (contract, backend, frontend) where a Business connects their wallet, adds BOT Chain with one click, and creates a Bounty that escrows BOT on-chain — which the backend indexes and which appears in the dApp's bounty list. This establishes the local-EVM contract test harness and the backend API test harness that every later ticket relies on.

- Contract workspace with the `BountyEscrow` contract and a local-EVM test harness running the full test suite.
- Backend: Postgres schema seeded, indexer doing a canonical snapshot-read sync from contract state into the `bounties` tables.
- Frontend: React+Vite shell, wallet connect, one-click BOT Chain add (EIP-3085), a create-bounty form.
- ABI artifact published somewhere static that the app reads from.

**Blocked by:** None — can start immediately.

**Status:** ready-for-human

- [x] A Business can connect a wallet and add the BOT Chain network to it with one click (chain ID 677/968 + RPC + explorer via wallet_addEthereumChain).
- [x] A Business can create a Bounty for a scope (hashed) with a future deadline, funding it in BOT; the funds are locked in escrow.
- [x] `createBounty` reverts when msg.value is zero or the deadline has already passed; a `BountyCreated` event fires on success.
- [x] The testnet and mainnet chain configurations (RPC, contract address) swap via environment as the only difference.
- [x] The backend snapshots contract state so a created Bounty is immediately readable through the API.
- [x] The frontend shows the new Bounty in a list of all bounties after a refresh.
- [x] Contract tests prove funds are held (balance-in = balance-out) at creation; API tests prove the create→index→read journey.
- [x] ABI + source artifact for the contract is stored in the repo and consumed by the app.
