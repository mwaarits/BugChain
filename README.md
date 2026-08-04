# BugChain — Bug Bounty Platform on BOT Chain

Escrow-based bug bounties on BOT Chain (EVM). A Business funds a Bounty, Researchers submit hash-committed reports, the contract pays out or refunds, and a Platform Admin resolves disputes.

## The problem

Bug bounty programs are fragmented, trust-heavy, and slow to settle. A business has little guarantee a researcher's finding will be compensated, a researcher has no guarantee a submitted report is legitimately rewarded, and disputes are decided unilaterally with no verifiable record. Money sits with untrusted third parties while a payout is negotiated.

## The solution

BugChain moves the bounty program on-chain with an escrow contract:

- **Escrow-secured funding** — a business commits the reward to `BountyEscrow`; researchers only race for bounties that are actually funded.
- **Hash-committed reports** — researchers publish only a hash of their report on-chain until the bounty closes, so findings can't be scooped, and can later prove authorship of what they submitted.
- **Deterministic lifecycle** — states (Active → under review → Closed, paid or refunded) and single-winner payout are enforced by the contract.
- **Dispute resolution** — a Platform Admin arbitrates flags and judgment calls on-chain, with a full audit trail.
- **Indexer + REST API** — a Hono backend indexes contract events into Postgres and serves the dApp; a Vite + React + wagmi frontend drives the whole lifecycle from the browser.

## Layout

| workspace | what it is |
|---|---|
| `contracts/` | Hardhat workspace — `BountyEscrow` Solidity contract + behavior tests |
| `backend/` | Hono + viem + Postgres (PGlite fallback) — indexer + REST API |
| `frontend/` | Vite + React + wagmi + shadcn/ui — wallet dApp |

The published contract interface lives in `abis/BountyEscrow.json` (compiler artifacts are gitignored); both backend and frontend read it from there. Domain terms are defined in `CONTEXT.md`.

## Clone & run (local)

### Prerequisites

- Node.js >= 20, npm
- MetaMask (or any injected wallet) for the frontend

### 1. Clone

```bash
git clone https://github.com/mwaarits/BugChain.git
cd BugChain
npm install
```

### 2. Tests (optional, recommended)

```bash
# contract tests (Seam 1)
npm run test --workspace contracts

# backend unit + integration tests (Seam 2; spins up its own hardhat node on :3137)
npm run test --workspace backend

# typecheck all workspaces
npm run typecheck
```

### 3. Run the app against a local chain

```bash
# start a local EVM node
npx hardhat node --port 3137   # from contracts/
```

Set up `backend/.env` from `backend/.env.example` and point it at the local node:

```env
RPC_URL=http://127.0.0.1:3137
CONTRACT_ADDRESS=<your deployed contract address>
ADMIN_PRIVATE_KEY=<a funded account>
ADMIN_OPERATOR=<your browser wallet>
PORT=3000
```

```bash
npm run dev --workspace backend
```

Set up `frontend/.env` from `frontend/.env.example`:

```env
VITE_CHAIN_ID=968
VITE_RPC_URL=http://127.0.0.1:3137
VITE_CONTRACT_ADDRESS=<your deployed contract address>
VITE_API_URL=http://localhost:3000
```

```bash
npm run dev --workspace frontend
```

Open the frontend, connect your wallet, and add the local chain. The repo has one deploy script: `npm run build:contracts` (compile + publish ABI).

## Deployment

- **Testnet / mainnet** are environment swaps — see `runbooks/testnet-deploy.md` and `runbooks/mainnet-gate.md`.
- The contract is deployed via Remix (never patched post-deploy); the ABI bump is copied into `abis/BountyEscrow.json`.

## Notes

- Platform fees: none (v1). Single winner per bounty. Admin is a trusted operator whose key lives only in the backend.