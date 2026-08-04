import { useState } from "react";
import { useAccount } from "wagmi";
import { API_URL } from "../chain";
import type { BountyRow } from "../lib/types";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import BountyDetail from "./BountyDetail";

export default function AdminPanel({ bounties }: { bounties: BountyRow[] }) {
  const { address } = useAccount();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const disputed = bounties.filter((b) => b.inDispute || b.disputeRequested);

  async function act(pathname: string, body: Record<string, unknown>) {
    setBusy(pathname + JSON.stringify(body));
    setError("");
    try {
      const res = await fetch(`${API_URL}${pathname}`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      if (!res.ok) setError((await res.json()).error ?? res.statusText);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  if (!address) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Disputes (Platform Admin)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          type="password"
          placeholder="Admin token (backend ADMIN_TOKEN)"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        {!token && <p className="text-xs text-muted-foreground">Enter the backend admin token to unlock dispute controls.</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!token && (
          <p className="text-sm text-muted-foreground">
            The backend signs dispute actions with its admin key; the token only gates access to those endpoints.
          </p>
        )}
        {token && disputed.length === 0 && (
          <p className="text-sm text-muted-foreground">No disputes raised or open.</p>
        )}
        {token &&
          disputed.map((b) => (
            <div key={b.bountyId} className="space-y-2 rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  #{b.bountyId} · {b.state}
                  {b.inDispute ? " · in dispute" : b.disputeRequested ? " · dispute requested" : ""}
                </p>
                <div className="flex gap-1">
                  {!b.inDispute && (
                    <>
                      <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act("/api/admin/dispute/open", { bountyId: b.bountyId, reason: "researcherFlag" })}>
                        Open (flag)
                      </Button>
                      <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act("/api/admin/dispute/open", { bountyId: b.bountyId, reason: "ownerSilence" })}>
                        Open (silence)
                      </Button>
                    </>
                  )}
                  {b.inDispute && (
                    <Button size="sm" disabled={!!busy} onClick={() => act("/api/admin/dispute/close", { bountyId: b.bountyId })}>
                      Close dispute
                    </Button>
                  )}
                </div>
              </div>
              {b.inDispute && (
                <p className="text-xs text-muted-foreground">
                  Evidence + judgment below — the backend signs judgment tx with its admin key; the business is locked out.
                </p>
              )}
              {b.inDispute && <BountyDetail b={b} adminToken={token} />}
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
