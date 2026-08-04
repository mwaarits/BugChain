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

export type BadgeVariant = "default" | "secondary" | "destructive";

export const STATE_VARIANT: Record<string, BadgeVariant> = {
  Active: "default",
  RefundPending: "secondary",
  Closed: "destructive"
};

export const SUB_STATE_VARIANT: Record<string, BadgeVariant> = {
  Submitted: "default",
  Accepted: "secondary",
  Rejected: "destructive"
};
