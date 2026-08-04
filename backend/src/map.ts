export const BOUNTY_STATES = ["Active", "RefundPending", "Closed"];
export const SUBMISSION_STATES = ["Submitted", "Accepted", "Rejected"];

export function mapBountyRow(row: any, confirmation: string): any {
  return {
    bountyId: row.bounty_id,
    scopeHash: row.scope_hash,
    scope: row.scope_text ?? null,
    escrowWei: row.escrow_wei,
    deadline: Number(row.deadline),
    business: row.business,
    state: BOUNTY_STATES[row.state],
    inDispute: row.in_dispute,
    disputeRequested: row.dispute_requested,
    firstSubmissionTs: row.first_submission_ts === null ? null : Number(row.first_submission_ts),
    confirmation
  };
}

export function mapSubmissionRow(row: any, report: any, confirmation: string): any {
  return {
    submissionId: row.submission_id,
    hash: row.hash,
    submitter: row.submitter,
    timestamp: Number(row.ts),
    state: SUBMISSION_STATES[row.state],
    confirmation,
    report: report
      ? { content: report.content, salt: report.salt, signature: report.signature, txHash: report.tx_hash }
      : null
  };
}
