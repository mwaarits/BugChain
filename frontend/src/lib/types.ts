export interface BountyRow {
  bountyId: number;
  scopeHash: string;
  escrowWei: string;
  deadline: number;
  business: string;
  state: string;
  inDispute: boolean;
  disputeRequested: boolean;
  firstSubmissionTs: number | null;
  confirmation: string;
}

export interface SubmissionRow {
  submissionId: number;
  hash: string;
  submitter: string;
  timestamp: number;
  state: string;
  confirmation: string;
  report: { content: string; salt: string; signature: string; txHash: string | null } | null;
}
