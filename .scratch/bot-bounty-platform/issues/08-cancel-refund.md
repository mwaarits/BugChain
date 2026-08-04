# 08 — Cancel, deadline & two-phase refund

**What to build:** A Business can recover escrow through every non-payment exit: cancel a Bounty that has zero submissions at any time, and — once every submission is rejected — request then confirm a refund through the two-phase window. The deadline's only job is to stop submissions and legalize zero-submission cancellation. The contract emits the right close reason either way.

**Blocked by:** 07

**Status:** ready-for-human

- [x] A Business can cancel a Bounty that has zero submissions; escrow returns immediately and the Bounty closes as `Closed(cancelled)`.
- [x] `cancelBounty` reverts as soon as any submission exists.
- [x] Past the deadline, submissions are refused; a pre-deadline submission still succeeds.
- [x] When every submission is Rejected, a Business can request a refund: the Bounty enters `RefundPending` and a `RefundRequested` event fires.
- [x] Only from `RefundPending` can a Business confirm the refund; the escrow returns and the Bounty closes as `Closed(refunded)`.
- [x] The two-phase window leaves a Researcher/dispute opening before funds leave.
- [x] In the Business dashboard, a zero-submission Bounty shows a cancel action, and a RefundPending/Bounty shows request + confirm refund actions alongside the current refundable state.
- [x] Contract tests prove each exit: zero-sub cancel, deadline submission block, all-rejected refund, confirm-from-wrong-state reverts; balance-in = balance-out throughout.
- [x] API tests: cancel/refund journeys observable through the API the frontend consumes.
