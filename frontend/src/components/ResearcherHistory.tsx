import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { API_URL } from "../chain";
import { shorten } from "../lib/utils";
import type { SubmissionHistoryRow } from "../lib/types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

const PAGE_SIZE = 50;

export default function ResearcherHistory({ version, onOpenBounty }: { version: number; onOpenBounty: (bountyId: number) => void }) {
  const { address } = useAccount();
  const [rows, setRows] = useState<SubmissionHistoryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!address) return;
    let alive = true;
    setError("");
    fetch(`${API_URL}/api/submissions?submitter=${address}&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.text()).slice(0, 200));
        return res.json() as Promise<{ total: number; submissions: SubmissionHistoryRow[] }>;
      })
      .then((data) => {
        if (alive) {
          setRows(data.submissions);
          setTotal(data.total);
        }
      })
      .catch((cause) => { if (alive) setError((cause as Error).message); });
    return () => { alive = false; };
  }, [address, version, page]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Submission history</CardTitle>
        <p className="text-xs text-muted-foreground">Findings submitted from {address ? shorten(address) : "your wallet"}.</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {error && <p className="text-sm text-destructive">Could not load submission history: {error}</p>}
        {!error && rows.length === 0 && <p className="text-sm text-muted-foreground">No submissions from this wallet yet.</p>}
        {rows.map((row) => (
          <button key={`${row.bountyId}-${row.submissionId}`} className="flex w-full flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-left hover:bg-muted/40" onClick={() => onOpenBounty(row.bountyId)}>
            <span><span className="font-medium">Bounty #{row.bountyId}</span><span className="mt-1 block text-xs text-muted-foreground">Submission #{row.submissionId} · {new Date(row.timestamp * 1000).toLocaleString()}</span></span>
            <span className="flex flex-wrap gap-1"><Badge variant={row.submissionState === "Rejected" ? "destructive" : row.submissionState === "Accepted" ? "secondary" : "default"}>{row.submissionState}</Badge><Badge variant={row.confirmation === "confirmed" ? "default" : "secondary"}>{row.confirmation}</Badge><Badge variant="outline">{row.bountyState}</Badge></span>
          </button>
        ))}
        {total > PAGE_SIZE && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <p className="text-xs text-muted-foreground">{from}–{to} of {total} submissions</p>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</Button>
              <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
