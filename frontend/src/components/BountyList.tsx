import { useEffect, useMemo, useState } from "react";
import { formatEther } from "viem";
import { useAccount } from "wagmi";
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from "lucide-react";
import { shorten } from "../lib/utils";
import { STATE_VARIANT } from "../lib/types";
import type { BountyRow } from "../lib/types";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import BountyDetail from "./BountyDetail";

export default function BountyList({ bounties, error, title = "Bounties", onSubmit, onChanged }: { bounties: BountyRow[]; error: string; title?: string; onSubmit?: (bountyId: number) => void; onChanged?: () => Promise<void> }) {
  const { address } = useAccount();
  const [selectedBounty, setSelectedBounty] = useState<BountyRow | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 6;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return bounties
      .filter((b) => {
        const matchesQuery = !needle || [String(b.bountyId), b.scopeHash, b.business].some((value) => value.toLowerCase().includes(needle));
        const matchesStatus = status === "all" || b.state === status;
        return matchesQuery && matchesStatus;
      })
      .sort((a, b) => Number(b.state === "Active") - Number(a.state === "Active"));
  }, [bounties, query, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const listPath = title === "Your bounties" ? "/app/bounties/new" : "/app/bounties";

  useEffect(() => {
    if (!selectedBounty) return;
    function close(event: KeyboardEvent) {
      if (event.key === "Escape") closeDetails();
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", close);
    };
  }, [selectedBounty]);

  useEffect(() => {
    function syncModalToPath() {
      const match = window.location.pathname.match(/^\/app\/bounties\/(\d+)$/);
      setSelectedBounty(match ? bounties.find((b) => b.bountyId === Number(match[1])) ?? null : null);
    }
    syncModalToPath();
    window.addEventListener("popstate", syncModalToPath);
    return () => window.removeEventListener("popstate", syncModalToPath);
  }, [bounties]);

  function openDetails(bounty: BountyRow) {
    setSelectedBounty(bounty);
    window.history.pushState({}, "", `/app/bounties/${bounty.bountyId}`);
  }

  function closeDetails() {
    setSelectedBounty(null);
    if (window.location.pathname.match(/^\/app\/bounties\/\d+$/)) window.history.replaceState({}, "", listPath);
  }

  function updateQuery(value: string) {
    setQuery(value);
    setPage(1);
  }

  function updateStatus(value: string) {
    setStatus(value);
    setPage(1);
  }

  if (!address) return null;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="font-display">{title}</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">{filtered.length} matching bounty{filtered.length === 1 ? "" : "ies"}</p>
        </div>
        <Badge variant="outline">{bounties.length} indexed</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">API unreachable — is the backend up? {error}</p>}
        {bounties.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" placeholder="Search bounty ID, scope hash, or business" value={query} onChange={(e) => updateQuery(e.target.value)} />
            </label>
            <label className="relative block">
              <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <select className="h-10 w-full appearance-none rounded-md border bg-background pl-9 pr-8 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" value={status} onChange={(e) => updateStatus(e.target.value)} aria-label="Filter bounty status">
                <option value="all">All statuses</option>
                <option value="Active">Active only</option>
                <option value="RefundPending">Refund pending</option>
                <option value="Closed">Closed</option>
              </select>
            </label>
          </div>
        )}
        {bounties.length === 0 && !error && (
          <p className="text-sm text-muted-foreground">No bounties indexed yet. Run the backend and sync.</p>
        )}
        {bounties.length > 0 && visible.length === 0 && (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">No bounties match these filters.</p>
        )}
        <div className="grid gap-2 lg:grid-cols-2">
        {visible.map((b) => (
          <div key={b.bountyId} data-testid={`bounty-card-${b.bountyId}`} className={`overflow-hidden rounded-md border transition-all ${b.state === "Closed" ? "border-border/50 bg-muted/20 opacity-50 grayscale hover:opacity-70" : "bg-background/40 hover:border-primary/35"}`}>
             <button
              className="w-full cursor-pointer px-4 py-4 text-left hover:bg-muted/40"
              onClick={() => openDetails(b)}
             >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Bounty #{b.bountyId}</p>
                  <p className="mt-1 text-lg font-bold">{formatEther(BigInt(b.escrowWei))} <span className="text-sm text-primary">BOT</span></p>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  <Badge className="whitespace-nowrap" variant={STATE_VARIANT[b.state] ?? "secondary"}>{b.state}</Badge>
                  <Badge className="whitespace-nowrap" variant={b.confirmation === "confirmed" ? "default" : "secondary"}>{b.confirmation}</Badge>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Deadline · {new Date(b.deadline * 1000).toLocaleDateString()}</p>
              </button>
             {onSubmit && b.state === "Active" && !b.inDispute && (
               <div className="flex justify-end border-t px-3 py-2">
                 <button className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-primary hover:underline" onClick={() => onSubmit(b.bountyId)}>Submit finding →</button>
               </div>
             )}
          </div>
        ))}
        </div>
        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t pt-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Page {currentPage} of {pageCount}</p>
            <div className="flex gap-2">
              <button className="grid size-9 place-items-center rounded-md border disabled:cursor-not-allowed disabled:opacity-40" disabled={currentPage === 1} onClick={() => setPage((value) => value - 1)} aria-label="Previous page"><ChevronLeft className="size-4" /></button>
              <button className="grid size-9 place-items-center rounded-md border disabled:cursor-not-allowed disabled:opacity-40" disabled={currentPage === pageCount} onClick={() => setPage((value) => value + 1)} aria-label="Next page"><ChevronRight className="size-4" /></button>
            </div>
          </div>
        )}
      </CardContent>
      {selectedBounty && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDetails(); }}>
             <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border bg-card shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="bounty-dialog-title">
             <div className="flex items-start justify-between gap-4 border-b p-5 sm:p-6">
               <div>
                 <div className="flex flex-wrap items-center gap-2">
                   <p className="form-section-label">Bounty #{selectedBounty.bountyId}</p>
                   <Badge variant={STATE_VARIANT[selectedBounty.state] ?? "secondary"}>{selectedBounty.state}</Badge>
                   <Badge variant={selectedBounty.confirmation === "confirmed" ? "default" : "secondary"}>{selectedBounty.confirmation}</Badge>
                 </div>
                 <h2 id="bounty-dialog-title" className="mt-2 text-xl font-bold">{formatEther(BigInt(selectedBounty.escrowWei))} BOT secured</h2>
               </div>
               <button className="grid size-9 shrink-0 place-items-center rounded-md border text-muted-foreground hover:text-foreground" onClick={closeDetails} aria-label="Close bounty details"><X className="size-4" /></button>
             </div>
             <div className="space-y-5 border-b p-5 text-sm sm:p-6">
               <div className="grid gap-3 sm:grid-cols-2">
                 <div className="rounded-md border bg-muted/20 p-3"><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Deadline</p><p className="mt-1.5 font-medium">{new Date(selectedBounty.deadline * 1000).toLocaleString()}</p></div>
                 <div className="rounded-md border bg-muted/20 p-3"><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Business</p><p className="mt-1.5 font-mono text-xs">{shorten(selectedBounty.business)}</p></div>
               </div>
               <section aria-labelledby="bounty-scope-title">
                 <div className="mb-2 flex items-center justify-between gap-3">
                   <h3 id="bounty-scope-title" className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Scope description</h3>
                   <span className="text-[10px] text-muted-foreground">Committed onchain</span>
                 </div>
                 <div className="rounded-md border bg-background/60 p-4 sm:p-5">
                   {selectedBounty.scope ? (
                     <p className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground/90">{selectedBounty.scope}</p>
                   ) : (
                     <p className="text-sm leading-6 text-muted-foreground">The full scope description is unavailable for this legacy bounty.</p>
                   )}
                   <div className={`${selectedBounty.scope ? "mt-4 border-t pt-3" : "mt-3"}`}>
                     <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Scope hash</p>
                     <p className="mt-1 break-all font-mono text-[11px] leading-5 text-muted-foreground">{selectedBounty.scopeHash}</p>
                   </div>
                 </div>
               </section>
             </div>
            <BountyDetail b={selectedBounty} onChanged={onChanged} />
          </div>
        </div>
      )}
    </Card>
  );
}
