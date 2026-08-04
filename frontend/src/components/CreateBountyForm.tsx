import { useState } from "react";
import { keccak256, parseEther, parseEventLogs, toBytes } from "viem";
import { useAccount, usePublicClient, useSignMessage, useWriteContract } from "wagmi";
import { CalendarClock, CheckCircle2, Coins, FileKey2, Info, LoaderCircle, ShieldCheck } from "lucide-react";
import { API_URL, CONTRACT_ADDRESS, CONTRACT_ABI } from "../chain";
import { shorten } from "../lib/utils";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

const PENDING_SCOPE_KEY = "nexus.pendingScope";

export default function CreateBountyForm({ onExplore, onChanged }: { onExplore: () => void; onChanged?: () => Promise<void> }) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { signMessageAsync } = useSignMessage();
  const publicClient = usePublicClient();
  const [scope, setScope] = useState("");
  const [deadline, setDeadline] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [createdBountyId, setCreatedBountyId] = useState<number | null>(null);
  const [stage, setStage] = useState("");
  const [fundedBounty, setFundedBounty] = useState<{ id: number; scope: string; tx: string } | null>(() => {
    try { return JSON.parse(localStorage.getItem(PENDING_SCOPE_KEY) ?? "null"); } catch { return null; }
  });

  async function saveScopeMetadata(id: number, value: string) {
    let lastError = "Metadata service did not confirm the scope.";
    const signature = await signMessageAsync({ message: `Save scope for BugChain bounty #${id}` });
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await fetch(`${API_URL}/admin/sync`, { method: "POST" });
        const response = await fetch(`${API_URL}/api/bounties/${id}/scope`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scope: value, signature })
        });
        if (response.ok) return;
        const data = await response.json().catch(() => ({})) as { error?: string };
        lastError = data.error ?? response.statusText;
        if (![404, 408, 429, 500, 502, 503, 504].includes(response.status)) break;
      } catch (error) {
        lastError = (error as Error).message;
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
    throw new Error(lastError);
  }

  async function create() {
    setError("");
    setDone("");
    setCreatedBountyId(null);
    setFundedBounty(null);
    const deadlineSec = Math.floor(new Date(deadline).getTime() / 1000);
    if (!scope || !deadline || !amount || Number.isNaN(deadlineSec)) {
      setError("Fill scope, deadline, and escrow.");
      return;
    }
    if (deadlineSec <= Math.floor(Date.now() / 1000) + 60) {
      setError("Deadline must be at least a minute in the future.");
      return;
    }
    setBusy(true);
    try {
      setStage("Confirm the transaction in your wallet...");
      const tx = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "createBounty",
        args: [keccak256(toBytes(scope)), BigInt(deadlineSec)],
        value: parseEther(amount)
      });
      setStage("Waiting for BOT Chain confirmation...");
      const receipt = await publicClient!.waitForTransactionReceipt({ hash: tx, confirmations: 5 });
      const event = parseEventLogs({ abi: CONTRACT_ABI, logs: receipt.logs, eventName: "BountyCreated" })[0] as unknown as { args: { bountyId: bigint } };
      if (!event) throw new Error("BountyCreated event missing from transaction receipt.");
      const bountyId = Number(event.args.bountyId);
      setStage("Indexing bounty and saving scope...");
       try {
         await saveScopeMetadata(bountyId, scope);
       } catch (error) {
         const pending = { id: bountyId, scope, tx };
         setFundedBounty(pending);
         localStorage.setItem(PENDING_SCOPE_KEY, JSON.stringify(pending));
         throw new Error(`Bounty #${bountyId} is funded onchain, but the scope could not be saved: ${(error as Error).message}`);
       }
       setCreatedBountyId(bountyId);
       localStorage.removeItem(PENDING_SCOPE_KEY);
       setDone(`Bounty #${bountyId} is active — tx ${shorten(tx)} confirmed.`);
       await onChanged?.();
      setScope("");
      setDeadline("");
      setAmount("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setStage("");
    }
  }

  if (!address) return null;
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/35 p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg border bg-card text-primary">
            <ShieldCheck className="size-5" />
          </span>
          <div className="space-y-1.5">
            <p className="form-section-label">01 / Business workspace</p>
            <CardTitle className="text-xl">Create and fund a bounty</CardTitle>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">
              Set the research boundary, review window, and guaranteed BOT reward. Funding is locked in escrow when you confirm.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="bounty-scope">Scope and testing boundaries</Label>
            <span className="font-mono text-[11px] text-muted-foreground">{scope.length} chars</span>
          </div>
          <div className="relative">
            <FileKey2 className="pointer-events-none absolute left-3.5 top-3.5 size-4 text-muted-foreground" />
            <Textarea
              id="bounty-scope"
              className="min-h-36 resize-y pl-10 leading-6"
              placeholder={"In scope: contracts, endpoints, and versions\nOut of scope: social engineering, denial of service..."}
              value={scope}
              onChange={(e) => setScope(e.target.value)}
            />
          </div>
          <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            Only the Keccak-256 scope commitment is written onchain; the readable copy is stored with your wallet signature. Keep a matching copy of the full scope for verification.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="bounty-deadline">Submission deadline</Label>
            <div className="relative">
              <CalendarClock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="bounty-deadline"
                className="cursor-pointer pl-10"
                type="datetime-local"
                value={deadline}
                onClick={(e) => e.currentTarget.showPicker()}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
            <p className="text-xs leading-5 text-muted-foreground">Uses your local timezone and must be in the future.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bounty-amount">Escrow reward</Label>
            <div className="relative">
              <Coins className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="bounty-amount" className="pl-10 pr-14 font-mono" type="number" min="0" step="0.01" placeholder="0.50" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 font-mono text-xs font-semibold text-muted-foreground">BOT</span>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">Transferred to the escrow contract in one wallet transaction.</p>
          </div>
        </div>
         {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}
         {fundedBounty && !done && (
           <div className="rounded-lg border border-secondary/30 bg-secondary/5 px-4 py-3 text-sm leading-5">
             <p className="font-semibold">Bounty #{fundedBounty.id} is funded onchain.</p>
             <p className="mt-1 text-muted-foreground">Only the off-chain scope copy is pending. Retry saving it without funding again.</p>
             <Button className="mt-3" size="sm" variant="outline" disabled={busy} onClick={async () => {
               setBusy(true);
               setError("");
               try {
                 await saveScopeMetadata(fundedBounty.id, fundedBounty.scope);
                 setCreatedBountyId(fundedBounty.id);
                 setDone(`Bounty #${fundedBounty.id} is active — tx ${shorten(fundedBounty.tx)} confirmed.`);
                 setFundedBounty(null);
                 localStorage.removeItem(PENDING_SCOPE_KEY);
                 setScope("");
                 setDeadline("");
                 setAmount("");
                 await onChanged?.();
               } catch (error) {
                 setError(`Scope save retry failed: ${(error as Error).message}`);
               } finally {
                 setBusy(false);
               }
             }}>Retry scope save</Button>
           </div>
         )}
        {(scope || deadline || amount) && !busy && !done && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="form-section-label">Transaction preview</p>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
              <span><strong className="block text-xs text-muted-foreground">Scope</strong>{scope.length} characters</span>
              <span><strong className="block text-xs text-muted-foreground">Deadline</strong>{deadline ? new Date(deadline).toLocaleString() : "Not set"}</span>
              <span><strong className="block text-xs text-muted-foreground">Escrow</strong>{amount || "0"} BOT</span>
            </div>
          </div>
        )}
        {done && (
          <div role="status" className="rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm leading-5">
            <p className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />{done}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={onExplore}>Explore bounties</Button>
              <Button size="sm" variant="outline" onClick={() => { setDone(""); setCreatedBountyId(null); }}>Create another bounty</Button>
              {createdBountyId !== null && <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/app/bounties/${createdBountyId}`)}>Copy bounty link</Button>}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-4 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-md text-xs leading-5 text-muted-foreground">Your wallet will request approval for the full escrow amount plus network gas.</p>
           <Button className="h-11 px-6 sm:min-w-40" disabled={busy || !!fundedBounty} onClick={create}>
            {busy && <LoaderCircle className="animate-spin" />}
            {busy ? stage || "Funding escrow..." : "Fund bounty"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
