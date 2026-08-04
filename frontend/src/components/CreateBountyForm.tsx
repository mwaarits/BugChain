import { useState } from "react";
import { keccak256, parseEther, toBytes } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import artifact from "../../../abis/BountyEscrow.json";
import { CONTRACT_ADDRESS } from "../chain";
import { shorten } from "../lib/utils";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

const ABI = artifact.abi;

export default function CreateBountyForm() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [scope, setScope] = useState("");
  const [deadline, setDeadline] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function create() {
    setError("");
    setDone("");
    const deadlineSec = Math.floor(new Date(deadline).getTime() / 1000);
    if (!scope || !deadline || !amount || Number.isNaN(deadlineSec)) {
      setError("Fill scope, deadline, and escrow.");
      return;
    }
    setBusy(true);
    try {
      const tx = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "createBounty",
        args: [keccak256(toBytes(scope)), BigInt(deadlineSec)],
        value: parseEther(amount)
      });
      setDone(`Bounty funded — tx ${shorten(tx)}. The indexer picks it up in a few seconds.`);
      setScope("");
      setDeadline("");
      setAmount("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!address) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Create a Bounty (Business)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label>Scope</Label>
          <Textarea
            placeholder="What is in and out of bounds for this bounty"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Stored on-chain as a hash — content stays private.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Deadline</Label>
            <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Escrow (BOT)</Label>
            <Input type="number" min="0" step="0.01" placeholder="0.5" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {done && <p className="text-sm text-muted-foreground">{done}</p>}
        <Button disabled={busy} onClick={create}>
          {busy ? "Funding escrow…" : "Fund bounty"}
        </Button>
      </CardContent>
    </Card>
  );
}
