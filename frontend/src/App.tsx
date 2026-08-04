import { useEffect, useState } from "react";
import { ArrowLeft, BriefcaseBusiness, FileSearch, Gavel, LayoutDashboard, Network } from "lucide-react";
import { useAccount, useConnect, useDisconnect, useReadContract, useSwitchChain, useWalletClient } from "wagmi";
import { botChain, CONTRACT_ADDRESS, CONTRACT_ABI, API_URL } from "./chain";
import { shorten } from "./lib/utils";
import type { BountyRow } from "./lib/types";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent } from "./components/ui/card";
import AdminPanel from "./components/AdminPanel";
import BountyList from "./components/BountyList";
import CreateBountyForm from "./components/CreateBountyForm";
import SubmitSubmission from "./components/SubmitSubmission";
import ResearcherHistory from "./components/ResearcherHistory";
import HomePage from "./components/HomePage";

function useBounties() {
  const [bounties, setBounties] = useState<BountyRow[]>([]);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  async function refresh(sync = false) {
    try {
      if (sync) {
        const synced = await fetch(`${API_URL}/admin/sync`, { method: "POST" });
        if (!synced.ok) throw new Error(`Indexer sync failed: ${synced.statusText}`);
      }
      const res = await fetch(`${API_URL}/api/bounties`);
      if (!res.ok) throw new Error((await res.text()).slice(0, 200));
      const data = (await res.json()) as { bounties: BountyRow[] };
      setBounties(data.bounties);
      setVersion((value) => value + 1);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10_000);
    return () => {
      clearInterval(t);
    };
  }, []);

  return { bounties, error, refresh, version };
}

type Workspace = "overview" | "business" | "researcher" | "admin";

const WORKSPACE_PATH: Record<Workspace, string> = {
  overview: "/app",
  business: "/app/bounties/new",
  researcher: "/app/bounties",
  admin: "/app/admin/disputes"
};

function workspaceFromPath(): Workspace {
  if (window.location.pathname.startsWith("/app/admin")) return "admin";
  if (window.location.pathname === "/app/bounties/new") return "business";
  if (window.location.pathname.startsWith("/app/bounties")) return "researcher";
  return "overview";
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

  async function switchToBotChain() {
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
      {!onBot && <Button onClick={switchToBotChain}>Switch to BOT Chain</Button>}
      <Badge variant={onBot ? "default" : "secondary"}>{onBot ? chain.name : "wrong chain"}</Badge>
      <Button variant="outline" onClick={() => disconnect()}>
        {shorten(address)}
      </Button>
    </div>
  );
}

function Dashboard() {
  const { isConnected, chain, address } = useAccount();
  const { bounties, error, refresh, version } = useBounties();
  const { switchChain } = useSwitchChain();
  const wallet = useWalletClient();
  const [workspace, setWorkspace] = useState<Workspace>(workspaceFromPath);
  const [submissionBountyId, setSubmissionBountyId] = useState("");
  const [historyVersion, setHistoryVersion] = useState(0);
  const { data: adminAddress } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "admin" });
  const [operatorAddress, setOperatorAddress] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/admin/auth/operator`)
      .then((r) => r.json())
      .then((data: { address?: string | null }) => setOperatorAddress(data.address ?? null))
      .catch(() => setOperatorAddress(null));
  }, []);

  async function switchToBotChain() {
    try {
      await switchChain({ chainId: botChain.id });
    } catch {
      if (!wallet.data) return;
      await wallet.data.addChain({ chain: botChain });
      await switchChain({ chainId: botChain.id });
    }
  }

  function navigateWorkspace(next: Workspace) {
    window.history.pushState({}, "", WORKSPACE_PATH[next]);
    setWorkspace(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openSubmission(bountyId: number) {
    setSubmissionBountyId(String(bountyId));
    if (workspace !== "researcher") navigateWorkspace("researcher");
    requestAnimationFrame(() => document.getElementById("researcher-submission-form")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const onBotChain = chain?.id === botChain.id;
  const isAdmin = !!address && ((!!adminAddress && address.toLowerCase() === (adminAddress as string).toLowerCase()) || (!!operatorAddress && address.toLowerCase() === operatorAddress.toLowerCase()));

  useEffect(() => {
    const navigate = () => setWorkspace(workspaceFromPath());
    window.addEventListener("popstate", navigate);
    return () => window.removeEventListener("popstate", navigate);
  }, []);
  return (
    <div className="nexus-page mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 sm:py-10 lg:px-10">
      <header className="dashboard-header flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="relative z-10">
          <p className="form-section-label">BugChain / secure bounty protocol</p>
          <a href="/" className="nexus-wordmark mt-3 block text-3xl sm:text-4xl">BugChain<span className="text-primary">:</span> APP</a>
          <p className="nexus-subtitle mt-3 max-w-xl">
            Fund responsible disclosure, commit private findings, and resolve every bounty with a verifiable BOT Chain state.
          </p>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {botChain.name} · {botChain.id} · {shorten(CONTRACT_ADDRESS)}
          </p>
        </div>
        <div className="relative z-10 flex flex-wrap items-center gap-2 self-start sm:justify-end sm:self-auto">
          <Button asChild variant="outline">
            <a href="/"><ArrowLeft /> Back to home</a>
          </Button>
          <WalletStatus />
        </div>
      </header>
      {isConnected && !onBotChain ? (
        <Card className="border-primary/30">
          <CardContent className="flex flex-col items-center gap-5 p-10 text-center">
            <span className="grid size-14 place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary"><Network /></span>
            <div>
              <h2 className="text-2xl font-bold">BOT Chain required</h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">BugChain transactions and bounty state live on {botChain.name}. Switch networks before continuing.</p>
            </div>
            <Button onClick={switchToBotChain}>Switch to BOT Chain</Button>
          </CardContent>
        </Card>
      ) : isConnected ? (
        <div className="space-y-6">
          <nav className="flex flex-wrap gap-2" aria-label="BugChain workspaces">
            {([
              ["overview", "Overview", LayoutDashboard],
              ["business", "Business", BriefcaseBusiness],
              ["researcher", "Researcher", FileSearch],
              ...(isAdmin ? [["admin", "Admin", Gavel] as const] : [])
            ] as const).map(([value, label, Icon]) => (
              <Button key={value} variant={workspace === value ? "default" : "outline"} onClick={() => navigateWorkspace(value)}>
                <Icon /> {label}
              </Button>
            ))}
          </nav>

          {workspace === "overview" && (
            <div className="grid gap-5 md:grid-cols-3">
              <WorkspaceCard icon={BriefcaseBusiness} label="Business workspace" title="Fund a security bounty" text="Define scope, lock BOT in escrow, and review incoming findings." action="Create bounty" onClick={() => navigateWorkspace("business")} />
              <WorkspaceCard icon={FileSearch} label="Researcher workspace" title="Find work and submit proof" text="Explore active bounties, commit a private report, and keep your receipt." action="Explore bounties" onClick={() => navigateWorkspace("researcher")} />
              {isAdmin && <WorkspaceCard icon={Gavel} label="Restricted workspace" title="Resolve active disputes" text="Platform Admin controls are isolated from normal bounty activity." action="Open admin" onClick={() => navigateWorkspace("admin")} />}
            </div>
          )}
          {workspace === "business" && (
            <div className="space-y-6">
              <CreateBountyForm onExplore={() => navigateWorkspace("researcher")} onChanged={() => refresh(true)} />
              <BountyList bounties={bounties.filter((b) => b.business.toLowerCase() === (address ?? "").toLowerCase())} error={error} title="Your bounties" onSubmit={openSubmission} onChanged={() => refresh(true)} />
            </div>
          )}
          {workspace === "researcher" && (
            <div className="space-y-6">
              <BountyList bounties={bounties} error={error} title="Explore bounties" onSubmit={openSubmission} onChanged={() => refresh(true)} />
              <div id="researcher-submission-form" className="scroll-mt-6">
                <SubmitSubmission key={submissionBountyId} initialBountyId={submissionBountyId} onChanged={async () => { await refresh(true); setHistoryVersion((value) => value + 1); }} />
              </div>
              <ResearcherHistory version={historyVersion + version} onOpenBounty={(bountyId) => { window.history.pushState({}, "", `/app/bounties/${bountyId}`); window.dispatchEvent(new PopStateEvent("popstate")); }} />
            </div>
          )}
          {workspace === "admin" && (isAdmin ? <AdminPanel bounties={bounties} onChanged={() => refresh(true)} /> : <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">This workspace is restricted to the Platform Admin wallet.</CardContent></Card>)}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-sm leading-6 text-muted-foreground">
            Connect a wallet to create bounties, submit reports, judge submissions, and track escrow.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function WorkspaceCard({ icon: Icon, label, title, text, action, onClick }: { icon: typeof BriefcaseBusiness; label: string; title: string; text: string; action: string; onClick: () => void }) {
  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col items-start p-6">
        <span className="grid size-11 place-items-center rounded-lg border bg-primary/5 text-primary"><Icon /></span>
        <p className="form-section-label mt-6">{label}</p>
        <h2 className="mt-2 text-xl font-bold">{title}</h2>
        <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">{text}</p>
        <Button className="mt-6" onClick={onClick}>{action}</Button>
      </CardContent>
    </Card>
  );
}

export default function App() {
  const [showApp, setShowApp] = useState(() => window.location.pathname.startsWith("/app"));

  function openApp(destination?: "business" | "researcher") {
    const path = destination === "business" ? WORKSPACE_PATH.business : destination === "researcher" ? WORKSPACE_PATH.researcher : WORKSPACE_PATH.overview;
    window.history.pushState({}, "", path);
    setShowApp(true);
    window.scrollTo({ top: 0 });
  }

  useEffect(() => {
    const navigate = () => setShowApp(window.location.pathname.startsWith("/app"));
    window.addEventListener("popstate", navigate);
    return () => window.removeEventListener("popstate", navigate);
  }, []);

  return showApp ? <Dashboard /> : <HomePage openApp={openApp} />;
}
