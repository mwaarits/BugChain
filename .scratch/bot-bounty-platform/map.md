# Map: Bug Bounty Platform on BOT Chain

## Destination

A deployed, working v1 of the bug bounty platform for solo SaaS developers and small businesses: a web dApp (off-chain) integrated with Solidity smart contracts on **BOT Chain** that escrow bounty funds in BOT and timestamp submission hashes on-chain. Contracts deployed once via Remix IDE, tested on the BOT Chain **testnet**, then deployed to **mainnet**.

## Notes

- Domain: bug bounty / security marketplace for SMBs; blockchain ecosystem BOT Chain; Solidity; Remix IDE deployment; testnet → mainnet.
- Execution is carried into the map: the destination is a deployed v1, not just a spec.
- Communication language: Bahasa Indonesia.
- Consult: /grilling and /domain-modeling (glossary lives in `CONTEXT.md` at repo root), /prototype for contract/UI fidelity, /research for facts.
- Standing decisions already made: three roles (Business, Researcher, Platform Admin); single contract deployed once via Remix, shared by all businesses; platform fee = free for now; single winner per bounty (no pro-rata).

## Decisions so far

<!-- the index — one line per closed ticket: enough to judge relevance, then zoom the link for the detail the ticket holds -->

- [BOT Chain ecosystem facts](issues/01-bot-chain-ecosystem.md) — BOT Chain is a standalone EVM L1 (mainnet 677, testnet 968); BOT is the native coin; Remix deploys with zero changes; add testnet manually (ChainList claims 968 for "Datagram"); re-verify eth_getLogs.
- [Escrow contract surface](issues/02-escrow-contract-surface.md) — single `BountyEscrow` contract, id-keyed bounties; functions `createBounty` (payable), `submitSubmission`, `acceptSubmission` (Business or admin-in-dispute), `rejectSubmission`, `markAllInvalid`, `cancelBounty` (atomic, zero submissions), two-phase refund (`requestRefund`→`confirmRefund`); events include a single `BountyClosed(reason)`; dispute = orthogonal `inDispute` flag with pluggable hooks.
- [Dispute and owner-silence workflow](issues/03-dispute-workflow.md) — dispute state on-chain, evidence off-chain; `raiseDispute` (with on-chain guards since the 2026-08-04 contract finalize: submitter-only researcher flags, timer-gated owner-silence, per-address cooldown, admin exempt; params admin-tunable, admin transferable) → `openDispute` (admin only, timer-gated ownerSilence: 3 days from first submission) → admin gets full judgment set while `inDispute` (accept/reject/markAllInvalid/confirmRefund) + `closeDispute`; no withdrawal path (admin never a payee); outcomes: paid/refunded → `Closed`, dismissed → back to `Active`; admin-is-trusted model.
- [Off-chain dApp surface and hash mechanics](issues/04-offchain-dapp-surface.md) — hash = `keccak256(1, bountyId, content, salt)` app-side with normalization rules + `signMessage` authorship + receipt download; Postgres stores reports keyed by on-chain submissionId; indexer: canonical snapshot-read sync (contract read surface added) + WebSocket live feed, `eth_getLogs` optional; DB-level idempotency (composite PKs), reorg watermark; frontend stack React+Vite+wagmi+viem+shadcn/ui → Vercel, backend Node+TS+Postgres+indexer → Render; EIP-3085 one-click add-chain; admin key in backend secret manager (known limitation, review before mainnet).

## Not yet specified

- Bounty discovery / UX details of the web app.
- Testnet → mainnet migration process (redeploy vs upgrade, verification steps).

## Out of scope

- Full HackerOne-style platform (discovery, comms, and validity judgments are off-chain by design, but only to the depth the dApp needs).
- Automatic payout on owner silence (deferred; owner-silence escalates to a dispute instead).
- Platform fees (free for now).
- Multi-winner bounties (single winner per bounty).
