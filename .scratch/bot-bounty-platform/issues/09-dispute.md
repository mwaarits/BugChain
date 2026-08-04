# 09 — Dispute & owner-silence

**What to build:** The full escalation path a Researcher and the Platform Admin can take when a Business is unfair or silent. Anyone can raise a dispute — cheaply, leaving irreversible on-chain proof — and the Admin can open one for either a researcher flag or Business owner-silence; the owner-silence open is blocked on-chain until a deploy-set window elapses from the first submission. While in dispute, only the Admin holds the judgment set, the Business is locked out, and the Admin can close the dispute (returning the Bounty to Active) or resolve it by payout/refund. The Admin can never withdraw escrow to themselves.

**Blocked by:** 08

**Status:** ready-for-human

- [x] `raiseDispute` is callable by anyone, costs only the flag + event, and records on-chain proof that a protest existed.
- [x] `openDispute(reason)` is Admin-only and sets the `inDispute` gate; `closeDispute` is Admin-only.
- [x] Opening an owner-silence dispute reverts on-chain until the window measured from the first submission has elapsed.
- [x] While `inDispute`, the Admin can accept/reject/mark-all-invalid/confirm-refund and close the dispute; the Business's judgment calls revert.
- [x] The Admin has no free withdrawal — funds leave only to an accepted submission's owner or back to the Business.
- [x] Resolutions: payout → `Closed(paid)`, refund → `Closed(refunded)`, dismissed → back to `Active` with the standing judgment intact.
- [x] Dispute evidence (report copies, communication) is stored off-chain and surfaced to the Admin in the web UI.
- [x] Contract tests: timer gate, admin-only gating, abuse prevention (admin cannot self-pay without an accepted submission), each outcome; API tests for the admin endpoints.
