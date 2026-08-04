import { useEffect, useState } from "react";
import { formatEther, keccak256, parseEther, toBytes } from "viem";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useSignMessage,
  useSwitchChain,
  useWalletClient,
  useWriteContract
} from "wagmi";
import artifact from "../../abis/BountyEscrow.json";
import { API_URL, botChain, CONTRACT_ADDRESS } from "./chain";
import { randomSalt, submissionHash } from "./lib/hash";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Textarea } from "./components/ui/textarea";

const ABI = artifact.abi;

interface BountyRow {
  bountyId: number;
  scopeHash: string;
  rewardWei: string;
  deadline: number;
  business: string;
  state: string;
  inDispute: boolean;
  disputeRequested: boolean;
  confirmation: string;
}

const STATE_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  Active: "default",
  RefundPending: "secondary",
  Closed: "destructive"
};

function shorten(addr: string): string {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

export default function App() {
  const { isConnected } = useAccount();
  const { bounties, error } = useBounties();
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Bug Bounty on BOT Chain</h1>
          <p className="text-sm text-muted-foreground">
            {botChain.name} · {botChain.id} · {shorten(CONTRACT_ADDRESS)}
          </p>
        </div>
        <WalletStatus />
      </header>
      {isConnected ? (
        <>
          <CreateBountyForm />
          <SubmitReport />
          <BountyList bounties={bounties} error={error} />
          <AdminPanel bounties={bounties} />
        </>
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Connect a wallet to create bounties, submit reports, and track escrow.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function useBounties() {
  const [bounties, setBounties] = useState<BountyRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const res = await fetch(`${API_URL}/api/bounties`);
        if (!res.ok) throw new Error((await res.text()).slice(0, 200));
        const data = (await res.json()) as { bounties: BountyRow[] };
        if (alive) setBounties(data.bounties);
        setError("");
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    }
    poll();
    const t = setInterval(poll, 10_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return { bounties, error };
}

function WalletStatus() {
  const { address, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const wallet = useWalletClient();

  if (!address) {
    return <Button onClick={() => connect({ connector: connectors[0] })}>Connect wallet</Button>;
  }

  async function addBotChain() {
    try {
      await switchChain({ chainId: botChain.id });
    } catch {
      const client = wallet.data;
      if (!client) return;
      await client.addChain({ chain: botChain });
      await switchChain({ chainId: botChain.id });
    }
  }

  const onBot = chain?.id === botChain.id;
  return (
    <div className="flex items-center gap-2">
      {!onBot && <Button onClick={addBotChain}>Add BOT Chain</Button>}
      <Badge variant={onBot ? "default" : "secondary"}>{onBot ? chain.name : "wrong chain"}</Badge>
      <Button variant="outline" onClick={() => disconnect()}>
        {shorten(address)}
      </Button>
    </div>
  );
}

function CreateBountyForm() {
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
      setError("Fill scope, deadline, and reward.");
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
        <CardTitle>Create a Bounty (Business)</CardTitle>
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
            <Label>Reward (BOT)</Label>
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

interface Receipt {
  bountyId: string;
  submissionId: number;
  content: string;
  salt: string;
  signature: string;
  txHash: string;
  hash: string;
}

function SubmitReport() {
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
        <CardTitle>Submit a Report (Researcher)</CardTitle>
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

function BountyList({ bounties, error }: { bounties: BountyRow[]; error: string }) {
  const { address } = useAccount();

  if (!address) return null;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Bounties</CardTitle>
        <Badge variant="outline">{bounties.length} open/known</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {error && <p className="text-sm text-destructive">API unreachable — is the backend up? {error}</p>}
        {bounties.length === 0 && !error && (
          <p className="text-sm text-muted-foreground">No bounties indexed yet. Run the backend and sync.</p>
        )}
        {bounties.map((b) => (
          <div key={b.bountyId} className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">
                #{b.bountyId} · {formatEther(BigInt(b.rewardWei))} BOT
              </p>
              <p className="text-xs text-muted-foreground">
                deadline {new Date(b.deadline * 1000).toLocaleString()} · {shorten(b.business)}
                {b.inDispute && " · in dispute"}
                {b.disputeRequested && " · dispute requested"}
              </p>
              <p className="mt-1 max-w-md truncate text-xs text-muted-foreground">scope {b.scopeHash}</p>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant={STATE_VARIANT[b.state] ?? "secondary"}>{b.state}</Badge>
              <Badge variant={b.confirmation === "confirmed" ? "default" : "secondary"}>
                {b.confirmation}
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AdminPanel({ bounties }: { bounties: BountyRow[] }) {
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
        <CardTitle>Disputes (Platform Admin)</CardTitle>
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
            <div key={b.bountyId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
              <p className="text-sm font-medium">
                #{b.bountyId} · {b.state}
                {b.inDispute ? " · inDispute" : b.disputeRequested ? " · dispute requested" : ""}
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
          ))}
      </CardContent>
    </Card>
  );
}
