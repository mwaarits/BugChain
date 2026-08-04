# Testnet deployment (BOT Chain, chain 968)

Goal: the platform running for real on testnet, driven only by environment config. Mainnet is then a config swap (see `mainnet-gate.md`).

## 0. Prereqs

- MetaMask with a funded testnet account (faucet: <https://faucet.botchain.ai/basic>)
- Repo checked out; `npm install` done
- The exact contract source: `contracts/contracts/BountyEscrow.sol` (single file, no imports — no flattening needed)

## 1. Add the testnet to MetaMask

- Network name: BOT Chain Testnet
- RPC URL: `https://rpc.bohr.life`
- Chain ID: `968`
- Currency symbol: `BOT`
- (Alternative: once the frontend is deployed, its "Add BOT Chain" button does this via EIP-3085.)

## 2. Deploy via Remix

1. Open <https://remix.ethereum.org> → File Explorer → new file `BountyEscrow.sol` → paste the repo source. Do not edit anything.
2. Solidity compiler tab: **0.8.24**, enable optimization, **runs 200** (must match `contracts/hardhat.config.ts`).
3. Deploy tab: Environment = **Injected Provider** (MetaMask on chain 968).
4. Constructor arg `_silenceWindow` = `259200` (3 days, in seconds).
5. Deploy, confirm the tx. Copy the deployed address.

## 3. Verify on the explorer

- Open the contract in the testnet explorer, "Verify & Publish".
- Compiler 0.8.24, optimization enabled / 200 runs, constructor arg `259200`.
- Verification must succeed — if it fails, the settings (not the source) are wrong; fix before continuing.

## 4. Wire the app (env-only)

Backend (`backend/.env`):

```
RPC_URL=https://rpc.bohr.life
# Optional: a WebSocket RPC supplied by your provider. Public wss://rpc.bohr.life returns HTTP 405.
WS_URL=
CONTRACT_ADDRESS=<deployed address>
ADMIN_PRIVATE_KEY=<admin key, in a secret manager — never in git>
ADMIN_TOKEN=<long random string>
DATABASE_URL=<postgres url>
```

Frontend (`frontend/.env`):

```
VITE_CHAIN_ID=968
VITE_RPC_URL=https://rpc.bohr.life
VITE_CONTRACT_ADDRESS=<deployed address>
VITE_API_URL=<backend url>
```

No code or ABI changes — `abis/BountyEscrow.json` already matches (verify bytecode by comparing against the Remix compilation if in doubt).

## 5. Smoke test (full life)

1. Frontend: connect wallet → "Add BOT Chain" → create a small funded Bounty.
2. Researcher wallet: submit a report, download the receipt JSON, confirm the submission shows in the list as `pending` → `confirmed`.
3. Business: accept → check the researcher received the payout and the bounty is `Closed`.
4. Second bounty: submit → reject all → request + confirm refund → business balance restored, bounty `Closed`.
5. Dispute: raise a flag → admin opens (researcherFlag) → admin accepts the submission → `Closed(paid)`.

## 6. Indexer on real testnet

- `eth_getLogs` works on `https://rpc.bohr.life` (probed 2026-08-04). The public `wss://rpc.bohr.life` endpoint rejects the WebSocket handshake with HTTP 405, so leave `WS_URL` empty unless another provider supplies a WebSocket RPC. With `WS_URL`, startup probes logs then subscribes; otherwise the 10s snapshot reconcile remains active.

## 7. Record

- Deployed address + tx hash, verification link, smoke-test results, and the `eth_getLogs` probe outcome go into a comment on ticket 11. These feed the mainnet gate.

## Rollback

Nothing to roll back on-chain short of draining testnet bounties; point the env at a fresh deployment and re-verify. Testnet funds are worthless, treat the deployment as disposable.
