import { useState } from "react";
import { useAccount, useReadContract, useSignMessage, useWriteContract } from "wagmi";
import artifact from "../../../abis/BountyEscrow.json";
import { randomSalt, submissionHash } from "@gmtbuilder/shared";
import { API_URL, CONTRACT_ADDRESS } from "../chain";
import { shorten } from "../lib/utils";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

const ABI = artifact.abi;

interface Receipt {
  bountyId: string;
  submissionId: number;
  content: string;
  salt: string;
  signature: string;
  txHash: string;
  hash: string;
}

export default function SubmitSubmission() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { signMessageAsync } = useSignMessage();
  const [bountyId, setBountyId] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const { data: count } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "submissionCountOf",
    args: bountyId ? [BigInt(bountyId)] : undefined,
    query: { enabled: !!bountyId }
  });

  async function submit() {
    setError("");
    setReceipt(null);
    const id = Number(bountyId);
    if (!bountyId || !content || Number.isNaN(id)) {
      setError("Pick a bounty id and write a report.");
      return;
    }
    if (count === undefined) {
      setError("Bounty not found on chain.");
      return;
    }
    setBusy(true);
    try {
      const salt = randomSalt();
      const hash = submissionHash(id, content, salt);
      const signature = await signMessageAsync({ message: { raw: hash } });
      const submissionId = Number(count);
      const txHash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "submitSubmission",
        args: [BigInt(id), hash]
      });
      const report = { submissionId, content, salt, signature, txHash, hash };
      const res = await fetch(`${API_URL}/api/bounties/${id}/submissions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(report)
      });
      if (!res.ok) setError(`Stored on-chain, but backend rejected the report: ${(await res.json()).error}`);
      setReceipt({ bountyId: String(id), ...report });
      setContent("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
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
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Submit a Submission (Researcher)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label>Bounty id</Label>
          <Input placeholder="0" value={bountyId} onChange={(e) => setBountyId(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Report content</Label>
          <Textarea
            rows={4}
            placeholder="Describe the vulnerability…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Hashed + signed in your wallet, then stored on-chain. Content itself stays off-chain.
          </p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {receipt && (
          <div className="rounded-md border p-3 text-xs">
            <p>
              Proof stored — hash {shorten(receipt.hash)} on submission {receipt.submissionId}.
            </p>
            <Button className="mt-2" size="sm" variant="outline" onClick={download}>
              Download receipt JSON
            </Button>
          </div>
        )}
        <Button disabled={busy} onClick={submit}>
          {busy ? "Signing & submitting…" : "Submit report"}
        </Button>
      </CardContent>
    </Card>
  );
}
