import { useState } from "react";
import { formatEther } from "viem";
import { useAccount } from "wagmi";
import { shorten } from "../lib/utils";
import type { BountyRow } from "../lib/types";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import BountyDetail from "./BountyDetail";

const STATE_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  Active: "default",
  RefundPending: "secondary",
  Closed: "destructive"
};

export default function BountyList({ bounties, error }: { bounties: BountyRow[]; error: string }) {
  const { address } = useAccount();
  const [openId, setOpenId] = useState<number | null>(null);

  if (!address) return null;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="font-display">Bounties</CardTitle>
        <Badge variant="outline">{bounties.length} open/known</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {error && <p className="text-sm text-destructive">API unreachable — is the backend up? {error}</p>}
        {bounties.length === 0 && !error && (
          <p className="text-sm text-muted-foreground">No bounties indexed yet. Run the backend and sync.</p>
        )}
        {bounties.map((b) => (
          <div key={b.bountyId} className="overflow-hidden rounded-md border">
            <button
              className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-3 text-left hover:bg-muted/50"
              onClick={() => setOpenId(openId === b.bountyId ? null : b.bountyId)}
            >
              <div>
                <p className="text-sm font-medium">
                  #{b.bountyId} · {formatEther(BigInt(b.escrowWei))} BOT
                </p>
                <p className="text-xs text-muted-foreground">
                  deadline {new Date(b.deadline * 1000).toLocaleString()} · {shorten(b.business)}
                  {b.inDispute && " · in dispute"}
                  {b.disputeRequested && " · dispute requested"}
                </p>
                <p className="mt-1 max-w-md truncate text-xs text-muted-foreground">scope {b.scopeHash}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Badge variant={STATE_VARIANT[b.state] ?? "secondary"}>{b.state}</Badge>
                <Badge variant={b.confirmation === "confirmed" ? "default" : "secondary"}>
                  {b.confirmation}
                </Badge>
              </div>
            </button>
            {openId === b.bountyId && <BountyDetail b={b} />}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
