import { useEffect, useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import artifact from "../../../abis/BountyEscrow.json";
import { CONTRACT_ADDRESS, API_URL } from "../chain";
import { shorten } from "../lib/utils";
import type { BountyRow, SubmissionRow } from "../lib/types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

const ABI = artifact.abi;

const SUB_STATE_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  Submitted: "default",
  Accepted: "secondary",
  Rejected: "destructive"
};

interface Props {
  b: BountyRow;
}

export default function BountyDetail({ b }: Props) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const { data: adminAddr } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "admin"
  });

  useEffect(() => {
    let alive = true;
    fetch(`${API_URL}/api/bounties/${b.bountyId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`detail ${res.status}`);
        return res.json();
      })
      .then((data) => alive && setSubmissions(data.submissions ?? []))
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [b.bountyId]);

  // ponytail: role seam — contract judges as business normally, admin while inDispute
  const isBusiness = !!address && address.toLowerCase() === b.business.toLowerCase();
  const isAdmin = !!address && !!adminAddr && address.toLowerCase() === (adminAddr as string).toLowerCase();
  const isJudger = b.inDispute ? isAdmin : isBusiness;
  const anyone = !!address;

  // ponytail: dynamic dispatch needs wagmi's ABI-typed overloads, cast the seam
  async function act(
    functionName: "acceptSubmission" | "rejectSubmission" | "markAllInvalid" | "cancelBounty" | "requestRefund" | "confirmRefund" | "raiseDispute",
    args: unknown[],
    label: string
  ) {
    setError("");
    setBusy(label);
    try {
      await writeContractAsync({ address: CONTRACT_ADDRESS, abi: ABI, functionName, args } as never);
      setBusy("");
    } catch (e) {
      setError((e as Error).message);
      setBusy("");
    }
  }

  const hasSubmitted = submissions.some((s) => s.state === "Submitted");
  const allRejected = submissions.length > 0 && submissions.every((s) => s.state === "Rejected");

  return (
    <div className="space-y-3 border-t px-4 py-3">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {submissions.length === 0 && !error && (
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
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs text-muted-foreground">
              {s.report.content}
            </pre>
          ) : (
            <p className="text-xs text-muted-foreground">
              hash {shorten(s.hash)} — report content not stored off-chain
            </p>
          )}
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        {anyone && b.state === "Active" && !b.inDispute && !b.disputeRequested && (
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act("raiseDispute", [BigInt(b.bountyId)], "raise")}>
            Raise dispute
          </Button>
        )}
        {isJudger && b.state === "Active" && (
          <>
            {isBusiness && !b.inDispute && submissions.length === 0 && (
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
        {b.inDispute && !isAdmin && (
          <p className="text-xs text-muted-foreground">Business locked out while the dispute is open — the admin judges.</p>
        )}
        {busy && <span className="text-xs text-muted-foreground">sending {busy} tx…</span>}
      </div>
    </div>
  );
}
