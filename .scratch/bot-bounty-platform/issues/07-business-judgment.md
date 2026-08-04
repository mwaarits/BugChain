# 07 — Business judgment & payout

**What to build:** From the web UI, a Business can exercise the full judgment set on submissions: accept one (which triggers the on-chain payout to the Researcher and closes the Bounty as paid), reject one, or mark all remaining submissions invalid in a single transaction. The backend reflects each judgment, the Researcher sees the outcome, and the escrow invariant holds — every BOT that leaves the contract is a payout, never a leak.

**Blocked by:** 06 — Researcher submission

**Status:** ready-for-human

- [x] A Business can accept a Submitted submission; the payout transfers the full reward to that Researcher's wallet and the Bounty closes as `Closed(paid)`.
- [x] `acceptSubmission` reverts unless the submission is in `Submitted` state; the same submission can never be paid twice.
- [x] Only the Bounty's Business — or the Platform Admin during an active dispute — can judge; any other caller reverts.
- [x] A Business can reject a single submission, and can mark all pending submissions invalid in one gas-economic transaction.
- [x] A judgment is recorded on-chain with events and reflected in the backend.
- [x] The Researcher's UI shows their submission as judged (accepted/rejected).
- [x] Contract tests: accept→payout sends the exact BOT (balance-in = balance-out), double-accept reverts, non-owner callers revert, single-winner invariant holds.
- [x] API tests: judgment through the API updates the observable state the frontend consumes.
