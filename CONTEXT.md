# Bug Bounty Platform (BOT Chain)

A web dApp that lets solo SaaS developers and small businesses offer bug bounties in BOT. Funds (escrow) and proof of claim order (timestamped hashes) live on-chain in a Solidity contract on BOT Chain; discovery, report details, and validity judgments stay off-chain.

## Language

**Bounty**:
An escrow of BOT offered by a Business to reward the first valid vulnerability report for a defined scope before a deadline.
_Avoid_: Reward, task, project

**Business**:
The party that funds a bounty, judges its submissions, and triggers payout or refund.
_Avoid_: Company, client, owner-entity

**Researcher**:
The party that submits vulnerability reports to a bounty.
_Avoid_: Hacker, reporter, user

**Platform Admin**:
The party that deploys the contract and can trigger payout or refunds only within an active dispute.
_Avoid_: Admin, moderator

**Escrow**:
BOT held by the contract until it is paid out to a researcher or refunded to the Business.
_Avoid_: Balance, deposit

**Submission**:
A vulnerability report; on-chain it exists only as a hash plus timestamp proving when it was submitted, while its content lives off-chain.
_Avoid_: Report, claim, ticket

**Submission states**:
`submitted` (awaiting judgment) → `accepted` (valid, triggers payout) or `rejected` (invalid). Only the Business — or the Platform Admin in a dispute — can move a submission between states.
_Avoid_: Open, closed, status

**Bounty states**:
`Active` → `RefundPending` → `Closed` (terminal after payout, refund, or zero-submission cancel). The Submission-states avoid list is scoped to submissions only; `Closed` is the Bounty terminal state and stays in use (as in `BountyClosed`, `CloseReason`).

**Deadline**:
The time after which a bounty with zero submissions can be refunded by the contract automatically.
_Avoid_: Expiry, end date

**Dispute**:
An escalation where the Platform Admin judges a rejected submission or a claim-order conflict and triggers the payout.
_Avoid_: Appeal, complaint

**Payout**:
Transfer of escrow BOT to the accepted researcher's wallet, triggered by the Business, or by the Platform Admin in a dispute.
_Avoid_: Reward payment, disbursement

**Refund**:
Return of escrow BOT to the Business, allowed only when there are zero submissions at the deadline or every submission is `rejected`.
_Avoid_: Withdraw, withdrawal
