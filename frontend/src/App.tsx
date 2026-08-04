import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain, useWalletClient } from "wagmi";
import { botChain, CONTRACT_ADDRESS, API_URL } from "./chain";
import { shorten } from "./lib/utils";
import type { BountyRow } from "./lib/types";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent } from "./components/ui/card";
import AdminPanel from "./components/AdminPanel";
import BountyList from "./components/BountyList";
import CreateBountyForm from "./components/CreateBountyForm";
import SubmitSubmission from "./components/SubmitSubmission";

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

export default function App() {
  const { isConnected } = useAccount();
  const { bounties, error } = useBounties();
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="flex items-center justify-between border-b border-border/60 pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wide">
            BUG BOUNTY<span className="text-primary">:</span> BOT CHAIN
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {botChain.name} · {botChain.id} · {shorten(CONTRACT_ADDRESS)}
          </p>
        </div>
        <WalletStatus />
      </header>
      {isConnected ? (
        <>
          <CreateBountyForm />
          <SubmitSubmission />
          <BountyList bounties={bounties} error={error} />
          <AdminPanel bounties={bounties} />
        </>
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Connect a wallet to create bounties, submit reports, judge submissions, and track escrow.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
