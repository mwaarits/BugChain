import { useEffect, useState } from "react";
import { useAccount, useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { CONTRACT_ADDRESS, CONTRACT_ABI, API_URL } from "../chain";
import { shorten } from "../lib/utils";
import { SUB_STATE_VARIANT } from "../lib/types";
import type { BountyRow, SubmissionRow } from "../lib/types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

type JudgeAction = "acceptSubmission" | "rejectSubmission" | "markAllInvalid" | "confirmRefund";
type Action = JudgeAction | "cancelBounty" | "requestRefund" | "raiseDispute";

// adminToken present + inDispute → judgment signs via the backend admin key (04's trust boundary)
const JUDGE_ENDPOINT: Record<JudgeAction, string> = {
  acceptSubmission: "/api/admin/judge/accept",
  rejectSubmission: "/api/admin/judge/reject",
  markAllInvalid: "/api/admin/judge/mark-all-invalid",
  confirmRefund: "/api/admin/judge/confirm-refund"
};

function isJudgeAction(a: Action): a is JudgeAction {
  return a in JUDGE_ENDPOINT;
}

interface Props {
  b: BountyRow;
  adminToken?: string;
  onChanged?: () => Promise<void>;
}

export default function BountyDetail({ b, adminToken, onChanged }: Props) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [reload, setReload] = useState(0);

  const { data: adminAddr } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "admin"
  });
  const { data: silenceWindow } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "silenceWindow"
  });

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    async function load() {
      try {
        const res = await fetch(`${API_URL}/api/bounties/${b.bountyId}`);
        if (!res.ok) throw new Error(`detail ${res.status}`);
        const data = await res.json();
        if (!alive) return;
        setSubmissions(data.submissions ?? []);
        setLoaded(true);
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [b.bountyId, reload]);

  // ponytail: role seam — business judges normally, admin (or token proxy) while inDispute
  const isBusiness = !!address && address.toLowerCase() === b.business.toLowerCase();
  const isAdmin = !!address && !!adminAddr && address.toLowerCase() === (adminAddr as string).toLowerCase();
  const isJudger = b.inDispute ? isAdmin || !!adminToken : isBusiness;
  const canReadReports = isBusiness || isAdmin;

  // ponytail: dynamic dispatch needs wagmi's ABI-typed overloads, cast the seam
  async function act(action: Action, args: [bigint] | [bigint, bigint], label: string) {
    setError("");
    setBusy(label);
    try {
      let txHash: `0x${string}`;
      if (action === "raiseDispute" && address) {
        const gate = await fetch(`${API_URL}/api/dispute/raise`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ bountyId: b.bountyId, address })
        });
        if (gate.status === 429) {
          const data = await gate.json();
          throw new Error(`Dispute flag rate limit reached — try again in ${Math.ceil(data.retryAfterSeconds / 3600)} hours.`);
        }
      }
      if (adminToken && b.inDispute && isJudgeAction(action)) {
        const res = await fetch(`${API_URL}${JUDGE_ENDPOINT[action]}`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({ bountyId: b.bountyId, submissionId: args.length > 1 ? Number(args[1]) : undefined })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? res.statusText);
        txHash = data.txHash;
      } else {
        txHash = await writeContractAsync({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: action, args } as never);
      }
      await publicClient?.waitForTransactionReceipt({ hash: txHash });
      await onChanged?.();
      setReload((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  const hasSubmitted = submissions.some((s) => s.state === "Submitted");
  const allRejected = submissions.length > 0 && submissions.every((s) => s.state === "Rejected");
  const accepted = submissions.some((s) => s.state === "Accepted");
  const nowSec = Math.floor(Date.now() / 1000);
  const submittedByMe = !!address && submissions.some((s) => s.submitter.toLowerCase() === address.toLowerCase());
  const ownerSilenceElapsed = b.firstSubmissionTs !== null && silenceWindow !== undefined && b.firstSubmissionTs + Number(silenceWindow) <= nowSec;
  const raiseReason = ownerSilenceElapsed ? 1 : 0; // 0 = ResearcherFlag, 1 = OwnerSilence (contract enforces both paths)
  const canRaise = !!address && (submittedByMe || ownerSilenceElapsed);
  const lifecycle = b.state === "Closed"
    ? accepted
      ? "Accepted / paid"
      : submissions.length > 0
        ? "Refunded"
        : "Cancelled"
    : b.inDispute
      ? "Dispute open"
      : b.disputeRequested
        ? "Dispute requested"
      : b.state === "RefundPending"
        ? "Refund pending"
        : hasSubmitted
          ? "Submission review"
          : allRejected
            ? "Rejected / refund available"
          : "Open for submissions";

  return (
    <div className="space-y-3 border-t px-4 py-3">
      {b.disputeRequested && !b.inDispute && (
        <p className="text-xs text-primary">Dispute requested — the platform admin can open it.</p>
      )}
      {b.inDispute && <p className="text-xs text-primary">Dispute open — the platform admin judges now.</p>}
      {b.state === "RefundPending" && !b.inDispute && (
        <p className="rounded-md border border-secondary/25 bg-secondary/5 px-3 py-2 text-xs leading-5 text-muted-foreground">
          Refund requested. This dispute window protects researchers before the escrow returns to the business.
        </p>
      )}
      {b.firstSubmissionTs && (
        <p className="text-xs text-muted-foreground">
          first submission {new Date(b.firstSubmissionTs * 1000).toLocaleString()} (owner-silence window anchor)
        </p>
      )}
      <div className="rounded-md border bg-muted/20 p-3">
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-[0.1em]">
          {['Open', 'Review', 'Resolved'].map((step) => {
            const active = (step === 'Open' && lifecycle === 'Open for submissions') || (step === 'Review' && ["Submission review", "Rejected / refund available", "Dispute requested", "Dispute open", "Refund pending"].includes(lifecycle)) || (step === 'Resolved' && ["Accepted / paid", "Refunded", "Cancelled"].includes(lifecycle));
            return <span key={step} className={`rounded-full border px-2 py-1 ${active ? 'border-primary/40 bg-primary/10 text-primary' : 'text-muted-foreground'}`}>{step}</span>;
          })}
          <span className="ml-auto text-muted-foreground">{lifecycle}</span>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {loaded && submissions.length === 0 && !error && (
        <p className="text-sm text-muted-foreground">No submissions indexed yet.</p>
      )}

      {submissions.map((s) => (
        <div key={s.submissionId} className="space-y-1 rounded-md border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              Submission #{s.submissionId} · {shorten(s.submitter)} ·{" "}
              {new Date(s.timestamp * 1000).toLocaleString()}
            </p>
            <div className="flex items-center gap-1">
              <Badge variant={SUB_STATE_VARIANT[s.state] ?? "secondary"}>{s.state}</Badge>
              <Badge variant={s.confirmation === "confirmed" ? "default" : "secondary"}>
                {s.confirmation}
              </Badge>
              {isJudger && s.state === "Submitted" && b.state === "Active" && (
                <>
                  <Button size="sm" disabled={!!busy} onClick={() => act("acceptSubmission", [BigInt(b.bountyId), BigInt(s.submissionId)], "accept")}>
                    Accept
                  </Button>
                  <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act("rejectSubmission", [BigInt(b.bountyId), BigInt(s.submissionId)], "reject")}>
                    Reject
                  </Button>
                </>
              )}
            </div>
          </div>
          {s.report ? (
            canReadReports ? (
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs text-muted-foreground">
                {s.report.content}
              </pre>
            ) : (
              <p className="text-xs text-muted-foreground">
                report content hidden — visible to the business or platform admin only
              </p>
            )
          ) : (
            <p className="text-xs text-muted-foreground">
              hash {shorten(s.hash)} — report content not stored off-chain
            </p>
          )}
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        {!!address && b.state === "Active" && !b.inDispute && !b.disputeRequested && (
          <>
            <Button size="sm" variant="outline" disabled={!!busy || !canRaise} onClick={() => act("raiseDispute", [BigInt(b.bountyId), BigInt(raiseReason)], "raise")}>
              Raise dispute
            </Button>
            {!canRaise && !submittedByMe && !ownerSilenceElapsed && (
              <p className="text-xs text-muted-foreground">Only researchers who submitted on this bounty can flag it.</p>
            )}
            {canRaise && ownerSilenceElapsed && <p className="text-xs text-muted-foreground">Owner-silence window has elapsed — flagging as {raiseReason ? "owner silence" : "researcher flag"}.</p>}
          </>
        )}
        {isJudger && b.state === "Active" && (
          <>
            {isBusiness && !b.inDispute && loaded && submissions.length === 0 && (
              <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act("cancelBounty", [BigInt(b.bountyId)], "cancel")}>
                Cancel bounty
              </Button>
            )}
            {hasSubmitted && (
              <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act("markAllInvalid", [BigInt(b.bountyId)], "invalidate")}>
                Mark all invalid
              </Button>
            )}
            {isBusiness && !b.inDispute && allRejected && (
              <Button size="sm" disabled={!!busy} onClick={() => act("requestRefund", [BigInt(b.bountyId)], "refund")}>
                Request refund
              </Button>
            )}
          </>
        )}
        {isJudger && b.state === "RefundPending" && (
          <Button size="sm" disabled={!!busy} onClick={() => act("confirmRefund", [BigInt(b.bountyId)], "confirm")}>
            Confirm refund
          </Button>
        )}
        {b.inDispute && !isJudger && (
          <p className="text-xs text-muted-foreground">Business locked out while the dispute is open — the admin judges.</p>
        )}
        {busy && <span className="text-xs text-muted-foreground">sending {busy} tx…</span>}
      </div>
    </div>
  );
}
