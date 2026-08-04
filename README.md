# BugChain — Bug Bounty Platform on BOT Chain

Escrow-based bug bounties on BOT Chain (EVM): a Business funds a Bounty, Researchers submit hash-committed reports, the contract pays out or refunds, and a Platform Admin resolves disputes.

## Layout

| workspace | what it is |
|---|---|
| `contracts/` | Hardhat workspace — `BountyEscrow` Solidity contract + behavior tests |
| `backend/` | Hono + viem + Postgres (PGlite fallback) — indexer + REST API |
| `frontend/` | Vite + React + wagmi + shadcn/ui — wallet dApp |

The published contract interface lives in `abis/BountyEscrow.json` (compiler artifacts are gitignored); both backend and frontend read it from there. Domain terms are defined in `CONTEXT.md`.

## Prerequisites

- Node.js >= 20, npm
- MetaMask (or any injected wallet) for the frontend

## Local dev

```sh
npm install

# contract tests (Seam 1)
npm run test --workspace contracts

# backend unit + integration tests (Seam 2; spins up its own hardhat node on :3137)
npm run test --workspace backend

# typecheck all workspaces
npm run typecheck
```

To run the whole app against a local chain:

```bash
npx hardhat node --port 3137   # in contracts/
# copy backend/.env.example -> backend/.env, set CONTRACT_ADDRESS to your deployed contract
npm run dev --workspace backend
npm run dev --workspace frontend   # frontend/.env -> VITE_RPC_URL=http://127.0.0.1:3137, VITE_API_URL=http://localhost:3000
```

The repo has one deploy script: ``npm run build:contracts`` (compile + publish ABI).

## Deployment

- **Testnet / mainnet** are environment swaps — see `runbooks/testnet-deploy.md` and `runbooks/mainnet-gate.md`.
- The contract is deployed via Remix (never patched post-deploy); the ABI bump is copied into `abis/BountyEscrow.json`.

## Notes

- Platform fees: none (v1). Single winner per bounty. Admin is a trusted operator whose key lives only in the backend.
