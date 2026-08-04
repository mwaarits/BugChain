import { useEffect, useState } from "react";
import { useAccount, usePublicClient, useReadContract, useSignMessage } from "wagmi";
import { API_URL, CONTRACT_ABI, CONTRACT_ADDRESS } from "../chain";
import type { BountyRow } from "../lib/types";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import BountyDetail from "./BountyDetail";

const SESSION_KEY = "nexus.adminSession";

interface Session { token: string; expiresAt: number }

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    return session.expiresAt > Date.now() ? session : null;
  } catch {
    return null;
  }
}

export default function AdminPanel({ bounties, onChanged }: { bounties: BountyRow[]; onChanged?: () => Promise<void> }) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { signMessageAsync } = useSignMessage();
  const { data: silenceWindow } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "silenceWindow" });
  const [operator, setOperator] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(loadSession);
  const [legacyToken, setLegacyToken] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [, tick] = useState(0);

  useEffect(() => {
    fetch(`${API_URL}/api/admin/auth/operator`)
      .then((r) => r.json())
      .then((data: { address?: string | null }) => setOperator(data.address ?? null))
      .catch(() => setOperator(null));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => tick((value) => value + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

  const bearer = session?.token ?? legacyToken;
  const isOperator = !!operator && !!address && address.toLowerCase() === operator.toLowerCase();
  const operatorMode = operator !== null;

  function signOut() {
    setSession(null);
    localStorage.removeItem(SESSION_KEY);
  }

  async function signIn() {
    if (!address) return;
    setBusy("sign-in");
    setError("");
    try {
      const challenge = await fetch(`${API_URL}/api/admin/auth/challenge`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address })
      });
      const challengeData = await challenge.json();
      if (!challenge.ok) throw new Error(challengeData.error ?? challenge.statusText);
      const signature = await signMessageAsync({ message: challengeData.nonce });
      const login = await fetch(`${API_URL}/api/admin/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, nonce: challengeData.nonce, signature })
      });
      const loginData = await login.json();
      if (!login.ok) throw new Error(loginData.error ?? login.statusText);
      const next = { token: loginData.token, expiresAt: loginData.expiresAt };
      setSession(next);
      localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  function silenceRemaining(bounty: BountyRow) {
    if (!bounty.firstSubmissionTs) return null;
    if (silenceWindow === undefined) return null;
    return Math.max(0, bounty.firstSubmissionTs + Number(silenceWindow) - Math.floor(Date.now() / 1000));
  }

  function formatRemaining(seconds: number) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m remaining`;
  }

  const disputed = bounties.filter((b) => b.inDispute || b.disputeRequested || (b.state !== "Closed" && b.firstSubmissionTs));

  async function act(pathname: string, body: Record<string, unknown>) {
    setBusy(pathname + JSON.stringify(body));
    setError("");
    try {
      const res = await fetch(`${API_URL}${pathname}`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${bearer}` },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          signOut();
          setError("Operator session expired — sign in again.");
        } else {
          setError(data.error ?? res.statusText);
        }
      } else {
        if (data.txHash) await publicClient?.waitForTransactionReceipt({ hash: data.txHash });
        await onChanged?.();
      }
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
        <CardTitle className="font-display">Dispute queue</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {operatorMode ? (
          <div className="rounded-md border p-3">
            <p className="text-sm font-medium">Operator access</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isOperator
                ? "Your wallet is the platform operator. Sign in with a wallet signature to unlock dispute controls."
                : `This workspace requires the operator wallet ${operator.slice(0, 8)}…${operator.slice(-6)}.`}
            </p>
            {isOperator && !session && (
              <Button className="mt-3" size="sm" disabled={!!busy} onClick={signIn}>
                Sign in as operator
              </Button>
            )}
            {isOperator && session && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Session active until {new Date(session.expiresAt).toLocaleTimeString()}.</span>
                <Button size="sm" variant="outline" onClick={signOut}>Sign out</Button>
              </div>
            )}
          </div>
        ) : (
          <>
            <Input
              type="password"
              placeholder="Admin token (backend ADMIN_TOKEN)"
              value={legacyToken}
              onChange={(e) => setLegacyToken(e.target.value)}
            />
            {!legacyToken && <p className="text-xs text-muted-foreground">Enter the backend admin token to unlock dispute controls.</p>}
          </>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!bearer && !operatorMode && (
          <p className="text-sm text-muted-foreground">
            The backend signs dispute actions with its admin key; the token only gates access to those endpoints.
          </p>
        )}
        {bearer && disputed.length === 0 && (
          <p className="text-sm text-muted-foreground">No disputes raised or open.</p>
        )}
        {bearer &&
          disputed.map((b) => (
            <div key={b.bountyId} className="space-y-2 rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    #{b.bountyId} · {b.state}
                  {b.inDispute ? " · in dispute" : b.disputeRequested ? " · dispute requested" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">Business judgment is suspended while this case is open.</p>
                <div className="flex gap-1">
                  {!b.inDispute && (
                    <>
                      {b.disputeRequested && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act("/api/admin/dispute/open", { bountyId: b.bountyId, reason: "researcherFlag" })}>
                        Open (flag)
                      </Button>}
                       <Button size="sm" variant="outline" disabled={!!busy || silenceRemaining(b) !== 0} onClick={() => act("/api/admin/dispute/open", { bountyId: b.bountyId, reason: "ownerSilence" })}>
                         {silenceRemaining(b) === null ? "Open (silence)" : silenceRemaining(b)! > 0 ? `Silence: ${formatRemaining(silenceRemaining(b)!)}` : "Open (silence)"}
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
              {b.inDispute && <BountyDetail b={b} adminToken={bearer} onChanged={onChanged} />}
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
