import { useState } from "react";
import { useAccount, usePublicClient, useSignMessage, useWriteContract } from "wagmi";
import { parseEventLogs } from "viem";
import { randomSalt, submissionHash } from "@gmtbuilder/shared";
import { CheckCircle2, Download, FileSearch, Fingerprint, Hash, Info, LoaderCircle } from "lucide-react";
import { API_URL, CONTRACT_ADDRESS, CONTRACT_ABI } from "../chain";
import { shorten } from "../lib/utils";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

interface Receipt {
  bountyId: string;
  submissionId: number;
  content: string;
  salt: string;
  signature: string;
  txHash: string;
  hash: string;
}

export default function SubmitSubmission({ initialBountyId = "", onChanged }: { initialBountyId?: string; onChanged?: () => Promise<void> }) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { signMessageAsync } = useSignMessage();
  const publicClient = usePublicClient();
  const [bountyId, setBountyId] = useState(initialBountyId);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [stage, setStage] = useState("");

  async function submit() {
    setError("");
    setReceipt(null);
    const id = Number(bountyId);
    if (!bountyId || !content || Number.isNaN(id)) {
      setError("Pick a bounty id and write a report.");
      return;
    }
    setBusy(true);
    try {
      const salt = randomSalt();
      const hash = submissionHash(id, content, salt);
      setStage("Sign the report commitment in your wallet...");
      const signature = await signMessageAsync({ message: { raw: hash } });
      setStage("Confirm the onchain submission...");
      const txHash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "submitSubmission",
        args: [BigInt(id), hash]
      });
      setStage("Waiting for BOT Chain confirmation...");
      const txReceipt = await publicClient!.waitForTransactionReceipt({ hash: txHash, confirmations: 5 });
      const event = (parseEventLogs({ abi: CONTRACT_ABI, logs: txReceipt.logs, eventName: "SubmissionSubmitted" }) as unknown as { args: { bountyId: bigint; submissionId: bigint } }[])
        .find((log) => Number(log.args.bountyId) === id);
      if (!event) throw new Error("SubmissionSubmitted event missing from transaction receipt.");
      const submissionId = Number(event.args.submissionId);
      setStage("Saving the private report...");
      const report = { submissionId, content, salt, signature, txHash, hash };
      let res: Response | undefined;
      for (let attempt = 0; attempt < 5 && (!res || res.status === 404); attempt++) {
        await fetch(`${API_URL}/admin/sync`, { method: "POST" });
        res = await fetch(`${API_URL}/api/bounties/${id}/submissions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(report)
        });
        if (res.status === 404) await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      }
      if (!res) throw new Error("Stored on-chain, but the report service is unavailable.");
      if (!res.ok) setError(`Stored on-chain, but backend rejected the report: ${(await res.json()).error}`);
      setReceipt({ bountyId: String(id), ...report });
      setContent("");
      await onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setStage("");
    }
  }

  function download() {
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bounty-${bountyId}-receipt.json`;
    a.click();
  }

  if (!address) return null;
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/35 p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg border bg-card text-secondary">
            <FileSearch className="size-5" />
          </span>
          <div className="space-y-1.5">
            <p className="form-section-label text-secondary">02 / Researcher workspace</p>
            <CardTitle className="text-xl">Commit a vulnerability report</CardTitle>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">
              Select the bounty, document the finding, then sign its unique hash before the commitment is submitted onchain.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        <div className="grid gap-5 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
          <div className="space-y-2">
            <Label htmlFor="submission-bounty">Bounty ID</Label>
            <div className="relative">
              <Hash className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="submission-bounty" className="pl-10 font-mono" inputMode="numeric" placeholder="e.g. 12" value={bountyId} onChange={(e) => setBountyId(e.target.value)} />
            </div>
            <p className="text-xs leading-5 text-muted-foreground">The active onchain bounty identifier.</p>
          </div>
          <div className="rounded-lg border bg-muted/25 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <Fingerprint className="size-4 text-primary" /> Commitment flow
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">BugChain adds a random salt, hashes your report, and asks your wallet to sign that hash before submission.</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="submission-content">Private report content</Label>
            <span className="font-mono text-[11px] text-muted-foreground">{content.length} chars</span>
          </div>
          <Textarea
            id="submission-content"
            className="min-h-52 resize-y leading-6"
            placeholder={"Summary\nImpact and affected component\nReproduction steps\nRecommended remediation"}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            The report content is sent to the BugChain backend for review. Only its salted hash and your signature become public proof.
          </p>
        </div>
        {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}
        {receipt && (
          <div role="status" className="rounded-lg border border-primary/25 bg-primary/5 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-semibold">Commitment successfully stored</p>
                <p className="mt-1 font-mono text-xs leading-5 text-muted-foreground">Submission #{receipt.submissionId} / hash {shorten(receipt.hash)}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">Your report is committed. This bounty remains active while the business reviews your finding.</p>
              </div>
            </div>
            <Button className="mt-4" size="sm" variant="outline" onClick={download}>
              <Download /> Download receipt
            </Button>
          </div>
        )}
        <div className="flex flex-col gap-4 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-md text-xs leading-5 text-muted-foreground">You will approve a message signature first, followed by the onchain commitment transaction.</p>
          <Button className="h-11 px-6 sm:min-w-40" disabled={busy} onClick={submit}>
            {busy && <LoaderCircle className="animate-spin" />}
            {busy ? stage || "Signing and submitting..." : "Submit report"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
