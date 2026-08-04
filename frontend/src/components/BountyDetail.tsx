import { useEffect, useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
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
}

export default function BountyDetail({ b, adminToken }: Props) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
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

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    fetch(`${API_URL}/api/bounties/${b.bountyId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`detail ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!alive) return;
        setSubmissions(data.submissions ?? []);
        setLoaded(true);
      })
      .catch((e) => alive && setError((e as Error).message));
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
      if (adminToken && b.inDispute && isJudgeAction(action)) {
        const res = await fetch(`${API_URL}${JUDGE_ENDPOINT[action]}`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({ bountyId: b.bountyId, submissionId: args.length > 1 ? Number(args[1]) : undefined })
        });
        if (!res.ok) setError((await res.json()).error ?? res.statusText);
      } else {
        await writeContractAsync({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: action, args } as never);
      }
      setReload((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  const hasSubmitted = submissions.some((s) => s.state === "Submitted");
  const allRejected = submissions.length > 0 && submissions.every((s) => s.state === "Rejected");

  return (
    <div className="space-y-3 border-t px-4 py-3">
      {b.disputeRequested && !b.inDispute && (
        <p className="text-xs text-primary">Dispute requested — the platform admin can open it.</p>
      )}
      {b.inDispute && <p className="text-xs text-primary">Dispute open — the platform admin judges now.</p>}
      {b.firstSubmissionTs && (
        <p className="text-xs text-muted-foreground">
          first submission {new Date(b.firstSubmissionTs * 1000).toLocaleString()} (owner-silence window anchor)
        </p>
      )}
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
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act("raiseDispute", [BigInt(b.bountyId)], "raise")}>
            Raise dispute
          </Button>
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
