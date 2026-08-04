Status: ready-for-agent

# Spec: Bug Bounty Platform on BOT Chain (v1)

## Problem Statement

Solo SaaS developers and small businesses want to reward security researchers for finding and reporting vulnerabilities in their products, but existing bounty platforms are built around big enterprises and gate-kept ecosystems. A small Business has no cheap, trust-minimized way to offer a bounty directly to the open market, and a Researcher has no way to prove when a report arrived and who wrote it.

The Business wants to put money behind a bug bounty with proof: funds are held in Escrow, submissions are timestamped and attributable, and payouts are irreversible-once-sent. Subjects do not trust each other — a Business may disappear after a Researcher's valid report, and a Researcher could falsify a claim order. The system must settle who is paid and when without requiring either party to trust the other's word, while keeping report **content** private (off-chain) and only proving existence and order on-chain.

## Solution

A web dApp built for BOT Chain where a **Business** creates a **Bounty** that escrows **BOT** in a single `BountyEscrow` Solidity contract, and any **Researcher** submits vulnerability reports as timestamped, authorship-signed hashes. Validity judgments, report content, and dispute evidence stay **off-chain**; escrow movements and claim order stay **on-chain**. A **Platform Admin** — a trusted operator whose key lives in the backend — can resolve only disputed bounties, never free-withdraw. The dApp indexes on-chain state, stores reports and the proof bundle each Researcher needs, and provides a wallet-based web UI for all three roles. The contract is deployed once via Remix to the BOT Chain testnet, verified, then redeployed identically to mainnet (chain config swap only).

## User Stories

1. As a **Business**, I want to fund a Bounty in BOT for a defined scope before a deadline, so that Researchers can see the reward and target.
2. As a **Business**, I want my funded BOT placed in on-chain **Escrow** so that it cannot be spent by me or anyone else until a Bounty outcome is decided.
3. As a **Business**, I want to specify the scope of the bounty (as a hash) and a deadline, so that Researchers know what is in and out of bounds.
4. As a **Business**, I want a one-click "Add BOT Chain" wallet action, so that I can use my existing wallet without manual network configuration.
5. As a **Business**, I want to see all my bounties and their current state (Active, RefundPending, Closed) in one dashboard, so that I know where my funds sit.
6. As a **Business**, I want to receive Researcher submissions as they arrive, so that I can judge them.
7. As a **Business**, I want to accept a submission, which triggers an immediate payout to that Researcher, so that a valid report is rewarded at once.
8. As a **Business**, I want to reject a submission, so that invalid or duplicate reports do not drain the escrow.
9. As a **Business**, I want to mark all pending submissions invalid in one transaction, so that I don't pay gas per rejection.
10. As a **Business**, I want to cancel a bounty while it has zero submissions and immediately recover my escrow, so that I can close unused bounties.
11. As a **Business**, I want to request and confirm a refund once every submission is Rejected, so that I recover funds when no report was valid.
12. As a **Business**, I want the two-phase refund (request → confirm) to leave a window for a Researcher to raise a dispute, so that a refund cannot silently override a valid claim.
13. As a **Business**, I want to see the full report content and the claimed authorship of each even where the on-chain hash only stores fingerprints, so that I can judge validity off-chain.
14. As a **Researcher**, I want to find open bounties on BOT Chain, so that I can choose where to focus my effort.
15. As a **Researcher**, I want to submit a report so that its hash and timestamp are recorded on-chain, so that I have proof of first-claim order.
16. As a **Researcher**, I want the on-chain hash to commit me to a specific content and a specific bounty, so that no one can rewrite or reattribute my report.
17. As a **Researcher**, I want my submission cryptographically binds my wallet address to the content, so that no one holding the report text can claim it.
18. As a **Researcher**, I want to download a receipt of my submission, so that I keep proof even if the server loses data.
19. As a **Researcher**, I want to see when my submission is judged, so that I know the outcome.
20. As a **Researcher**, I want to raise a dispute protesting a rejection, so that a silent or unfair Business cannot bury a valid report.
21. As a **Researcher**, I want the dispute flag on-chain as proof that I protested before any refund, so that no refund can happen quietly.
22. As a **Researcher**, I want to see bounty state and my submission state as "pending" until the chain has confirmed finalization, so that I do not act on a reverted block.
23. As a **Platform Admin**, I want to open a dispute when a Business has gone silent for the window after the first submission, so that Researchers are not unpaid forever.
24. As a **Platform Admin**, I want to judge and pay an accepted submission inside a dispute, so that valid reports are rewarded when the Business is unresponsive.
25. As a **Platform Admin**, I want to reject/mark-all-invalid inside a dispute, so that the full Business judgment set is available during adjudication.
26. As a **Platform Admin**, I want to close a dispute returning the bounty to its prior state, so that an unfounded dispute does not block the bounty forever.
27. As a **Platform Admin**, I want an on-chain timer to gate owner-silence disputes, so that a valuable bounty cannot be forced into dispute before the window.
28. As a **Platform Admin**, I have no free-withdrawal function, so that I can never pocket escrow funds that were not won by a real accepted submission.
29. As a **Business** in a dispute, I want my judgment rights suspended and windowed to the Admin, so that an interested party cannot influence the outcome.
30. As a **user of the platform**, I want every money move (bounty created, submission, judgment, refund, dispute) to be auditable via public events, so that the whole flow is transparent.
31. As a **Business**, I want to deploy once and have every subsequent bounty reuse the same contract, so that there is no per-bounty contract-deployment cost.
32. As an **operator**, I want the off-chain indexer to rebuild canonical state from contract reads, so that the app never depends on fragile event history.
33. As an **operator**, I want DB-level idempotency so a replayed sync cannot dup logs or money-claims.
34. As a **Researcher**, I want my report content to live off-chain, so that the sensitive details do not become permanent blockchain data.

## Implementation Decisions

### On-chain: single `BountyEscrow` contract

- **One contract, many bounties.** A single `BountyEscrow` contract (deployed once via Remix, reused by all Businesses) manages bounty-id-keyed bounties. No per-bounty deploy.
- **Roles.** `Business` — the creator of a bounty, may touch its own funds. `Platform Admin` — a fixed deploy-time address that touches funds *only* while a bounty is `inDispute`. `Researcher` — anyone, via `submitSubmission` only.
- **State model** (`Bounty`: `scopeHash`, `reward`=msg.value, `deadline`, `business`, `submissionCount`, `state` Active|RefundPending|Closed, `inDispute`, `disputeRequested`; `Submission`: `hash`, `submitter`, `timestamp`, `state` Submitted|Accepted|Rejected).
- **Function surface** (from ticket 02): `createBounty(scopeHash, deadline) payable → bountyId`; `submitSubmission(bountyId, hash)`; `acceptSubmission(bountyId, submissionId)` (Business, or Admin while inDispute) → payout once → `Closed(paid)`; `rejectSubmission`; `markAllInvalid`; `cancelBounty` (only while `submissionCount == 0`) → immediate refund → `Closed(cancelled)`; two-phase refund `requestRefund` → `confirmRefund` (window for a dispute), plus `bountyCount`, `bountyOf`, `submissionCountOf`, `submissionAt`, `disputeFlag` read helpers.
- **Bounty state machine**: submissions only pre-deadline, only while `Active` and not `inDispute`. `acceptSubmission` → `Closed(paid)`. All Rejected → `requestRefund` → `RefundPending` → `confirmRefund` → `Closed(refunded)`. Zero submissions → `cancelBounty` → `Closed(cancelled)`. Deadline only cuts submissions and legalizes zero-submission cancel.
- **Events** are the full set for indexing: `BountyCreated`, `SubmissionSubmitted`, `SubmissionJudged`, `RefundRequested`, `BountyClosed(bountyId, Reason)` (single close reason: cancel|paid|refunded), `DisputeRaised`, `DisputeOpened`, `DisputeResolved`. Submissions timestamps come from the block header/receipt (not re-emitted).
- **Two-phase refund** gives a Researcher a dispute window before escrow leaves; `cancelBounty` stays one-phase because a zero-submission bounty has nobody to protest.

### Dispute and owner-silence (from ticket 03)

- Dispute **state is on-chain** (the contract must gate the Admin); **evidence is off-chain**.
- Two triggers. `raiseDispute(bountyId)` — anyone, cheap, sets `disputeRequested` flag + event. `openDispute(bountyId, reason)` — Admin only, sets the `inDispute` gating flag. `closeDispute` — Admin only.
- **Owner-silence timer**: `SILENCE_WINDOW = 3 days` (deploy-set constant) from the **first submission's timestamp**, enforced on-chain in `openDispute(ownerSilence)` via revert. Researcher-flag has no timer.
- **While `inDispute`** the Admin holds the full Business judgment set (`acceptSubmission`, `rejectSubmission`/`markAllInvalid`, `confirmRefund`, `closeDispute`); the Business is locked out.
- **Abuse prevention is structural, not trust**: no free-withdrawal function (Admin can never be a payee); funds only exit to an accepted submission's owner (→ `Closed(paid)`) or back to the Business (→ `Closed(refunded)`); the owner-silence open is time-gated; all Admin actions emit audit events. Accepted residual: an Admin could fabricate a submission and accept it — accepted as a v1 trust assumption (**Platform Admin is a trusted operator**).
- **Dispute outcomes** (no remainder, no fees): pay → `Closed(paid)`; refund → `Closed(refunded)`; dismissed → `closeDispute` restores `Active` and the original judgment stands.

### Hash & authorship scheme (from ticket 04)

```
hash = keccak256(abi.encodePacked(uint8(1) /* schema version */, uint256 bountyId, content, salt))
```

- Content hashed **app-side before the tx**; the contract only ever sees the `bytes32`.
- `salt` = 32 random bytes generated app-side at draft time; `bountyId` is bound into the hash so a report is committed to exactly one bounty.
- **Normalization rules** (must be reproduced exactly, reuse-tested): UTF-8 encode, LF line endings, trailing whitespace stripped per line, single trailing newline removed.
- **Authorship**: the Researcher `signMessage(hash)` at submit; `(content, salt, signature)` stored off-chain keyed by on-chain `submissionId`. Keccak proves knowledge of the preimage; the signature binds the submitter address.
- **Researcher receipt** = `(bountyId, submissionId, hash, content, salt, signature, txHash)` downloadable, so the salt (client-only security) is backed up outside the server.

### Off-chain storage, indexing, correctness

- **Postgres**: bounty index, full reports `(content, salt, signature)`, messages, validity decisions, dispute evidence. Browser holds nothing durable.
- **Indexer**: canonical truth = **contract state by snapshot reads** (full walk `for id in 0..bountyCount-1`), not events. Live feed via WebSocket subscription + periodic snapshot reconcile; `eth_getLogs` is an optional historical backfill (mainnet support is uncertain — *re-verify at integration*; design does not depend on it).
- **Idempotency**: upserts `ON CONFLICT` on composite PK; event-log rows carry `(block_num, tx_index, log_index)` unique key, so replay from any point is safe.
- **Reorg handling**: each row carries a `block_confirmed` watermark; UI marks `pending` until finality (~5–10 blocks ≈ 4–8 s at 0.75 s blocks); drift detection triggers a rescan of only the affected bounty.
- **Read surface added to the contract** (from ticket 04): `bountyCount`, `bountyOf`, `submissionCountOf`, `submissionAt`, `disputeFlag`.

### UI / tooling / deployment

- **Frontend**: React + Vite + TypeScript, **wagmi** + **viem**, shadcn/ui + Tailwind. Static deploy → **Vercel**.
- **Backend**: Node + TypeScript (Hono/Express minimal), **Postgres**, indexer service; deploy → **Render** (container + Postgres).
- **Auth**: wallet-based (identity = address, no login/password).
- **Chain config**: BOT Chain mainnet = chain ID 677, RPC `https://rpc.botchain.ai`, explorer `https://scan.botchain.ai`; testnet = chain ID **968**, RPC `https://rpc.bohr.life`, faucet `https://faucet.botchain.ai/basic`. EVM-compatible, zero contract changes; testnet must be added manually (ChainList attributes 968 to "Datagram"). 0.75 s blocks, BOT = native coin (10^18 wei), not ERC-20. One-click chain add via EIP-3085 (`wallet_addEthereumChain`). `wallet_watchAsset` is not applicable (BOT is not an ERC-20).
- **Contract deploy**: still via **Remix** IDE; ABI + source stored in the repo, app reads the ABI from there. Testnet → mainnet = env swap only (RPC + chainId + contractAddress).
- **Trust boundary**: Business/Researcher keys live **only in the browser**; the backend has no signing authority for them. The **Admin private key** lives in the backend env inside a secret manager; the backend exposes the admin endpoints (open/close/resolve dispute). Signing via viem.

### Known limitations (recorded)

- Single Admin key in the backend = single point of failure (server compromise → dispute can be manipulated). Review before mainnet; key rotation plan on leak; never committed.
- `eth_getLogs` mainnet is uncertain (docs vs probe) — re-verify at integration; design runs without it.
- BO Wallet (official mobile app) has its own non-injected SDK — **out of scope for web v1**.
- Platform fees: **free for now**. Single winner per bounty (no pro-rata). Admin trusted-operator model.

## Testing Decisions

- **A good test asserts external behavior, not implementation detail**: **drive** the contract through its public functions and the API through real requests, asserting on observable state transitions, funds (wei) and events — never on internal storage layout.
- **Seam 1 — contract behavior on a local EVM** (Hardhat/Foundry working a stand-in for BOT Chain): the full `BountyEscrow` sequence — create→submit→accept pays the exact eth to the submitter and closes with `reason=paid`; all-rejected→request→confirm refunds the Business exactly; `cancelBounty` only at zero submissions; reject-with-one-submission; deadline blocks submissions; `markAllInvalid`; in-dispute admin-only authorization (Business locked, Admin may accept/reject/refund/close); `openDispute(ownerSilence)` reverts before the window; admin has no withdrawal path; events fired per state change; no remainder escaping the contract (balance-in = balance-out invariant over every path).
- **Seam 2 — backend HTTP API**: full user journeys — create/fund & read bounty, submit with normalization+sign, receipt regeneration (same `(content, salt)` re-hashes to the same on-chain hash; verify signatures), refund/dispute flow served as the Business/Admin/Researcher UI would call it; the backends pointed at a local chain node so chain effects are real and observable.
- **Off-chain-only behaviors covered by the API seam**: hash **normalization test vectors** (LF-only, trailing whitespace, trailing newline — exactly reproducible); receipt contains all six fields; salting random uniqueness; ownership proof via signature-to-address; reorg watermark `pending`→`confirmed` flow; indexer idempotent replay (upsert runs twice, single visible effect).
- **Prior art**: none yet in this repo (greenfield). The contract tests take the form of standard project patterns for EVM state machines; API tests are request-shaped like a contract-driven dApp backend. These become the prior art for future bounties and modules.

## Out of Scope

- Full hacker-one-style platform: discovery, comms, and validity judgments stay off-chain, only to the depth the dApp needs.
- Automatic payout on extended Business silence — owner-silence escalates to a dispute instead (manual, Admin-driven).
- Platform fees (free for now).
- Multi-winner or pro-rata bounties (single winner per bounty).
- BO Wallet mobile SDK integration.
- On-chain storage of report content (content lives off-chain by design).
- Fine-grained Bounty discovery / marketing UX and the testnet→mainnet migration runbook are left un-specified by the map — see Further Notes.

## Further Notes

- Communication language for this effort: Bahasa Indonesia (the resolvers and comments above were produced in Bahasa Indonesia); code and commit messages follow the repo's existing conventions.
- **Remaining fog from the map** (deliberately un-ticketed by wayfinder, in-scope for v1): (a) web-app bounty discovery/UX details; (b) the testnet→mainnet migration process (redeploy vs upgrade, verification steps). Both may surface as small tickets/decisions during implementation; they did not need wayfinder-resolution and are intentionally left for the build.
- The contract is the only artifact that **cannot be patched after deploy** — its interface is locked and treated as a hard requirement; the implementation decisions above are the interface contract the tickets agreed.
- Domain vocabulary (Bounty, Business, Researcher, Platform Admin, Escrow, Submission, Submission states, Deadline, Dispute, Payout, Refund) is defined in `CONTEXT.md`; use it verbatim throughout issues and code naming ("report", "reward", "status", "expiry" are avoided).