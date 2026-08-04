import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Code2,
  LockKeyhole,
  Radar,
  ShieldCheck,
  Sparkles,
  Terminal,
  Zap
} from "lucide-react";
import { Button } from "./ui/button";

const steps = [
  {
    icon: Radar,
    number: "01",
    title: "Publish a scope",
    text: "Define the target, deadline, and reward. The bounty is committed onchain before research begins."
  },
  {
    icon: LockKeyhole,
    number: "02",
    title: "Lock the reward",
    text: "BOT moves into a purpose-built escrow contract, proving the payout is real and available."
  },
  {
    icon: Code2,
    number: "03",
    title: "Submit privately",
    text: "Researchers commit a report hash first, keeping sensitive disclosure details out of public view."
  },
  {
    icon: CircleDollarSign,
    number: "04",
    title: "Resolve and pay",
    text: "Valid findings settle directly from escrow, with an explicit dispute path when consensus breaks."
  }
];

const guarantees = [
  "Reward funded before submissions open",
  "Every state transition independently verifiable",
  "Commitment-based responsible disclosure",
  "Deterministic settlement on BOT Chain"
];

export default function HomePage({ openApp }: { openApp: () => void }) {
  return (
    <div className="home-shell min-h-screen overflow-hidden bg-background text-foreground">
      <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <a href="/" className="group flex items-center gap-3" aria-label="NEXUS home">
          <span className="grid size-9 place-items-center rounded-md border border-primary/40 bg-primary/10 shadow-[0_0_24px_rgba(0,240,255,0.16)]">
            <Bot className="size-5 text-primary" />
          </span>
          <span className="font-display text-lg font-bold tracking-[0.16em]">NEXUS</span>
          <span className="hidden border-l border-border pl-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground sm:block">
            Security network
          </span>
        </a>

        <nav className="hidden items-center gap-8 text-sm font-semibold text-muted-foreground md:flex" aria-label="Primary navigation">
          <a className="transition-colors hover:text-primary" href="#protocol">Protocol</a>
          <a className="transition-colors hover:text-primary" href="#network">Network</a>
          <a className="transition-colors hover:text-primary" href="#security">Security</a>
        </nav>

        <Button onClick={openApp} variant="outline" className="border-primary/40 bg-primary/5 text-primary hover:bg-primary hover:text-primary-foreground">
          Launch app <ArrowRight />
        </Button>
      </header>

      <main>
        <section className="relative mx-auto grid min-h-[760px] max-w-7xl items-center gap-14 px-5 pb-24 pt-16 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:px-10 lg:pb-28 lg:pt-20">
          <div className="hero-grid pointer-events-none absolute inset-x-0 top-0 h-[760px] opacity-50" />
          <div className="orb orb-cyan pointer-events-none absolute -left-44 top-28 size-[430px] rounded-full" />
          <div className="relative z-10 max-w-3xl">
            <div className="reveal-up mb-7 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/[0.07] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-primary">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-70" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
              Built on BOT Chain
          </div>

            <h1 className="reveal-up reveal-delay-1 font-display text-5xl font-bold leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-[76px]">
              Security work,
              <span className="block text-primary">settled by code.</span>
            </h1>

            <p className="reveal-up reveal-delay-2 mt-7 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
              NEXUS connects builders with elite security researchers through transparent bounties, protected disclosures, and trustless BOT escrow.
            </p>

            <div className="reveal-up reveal-delay-3 mt-9 flex flex-col gap-3 sm:flex-row">
              <Button onClick={openApp} size="lg" className="h-12 px-6 text-base shadow-[0_0_30px_rgba(0,240,255,0.2)]">
                Explore active bounties <ArrowRight />
              </Button>
              <a href="#protocol" className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-border bg-card/50 px-6 text-sm font-bold transition-colors hover:border-secondary/60 hover:text-secondary">
                How it works <ChevronRight className="size-4" />
              </a>
            </div>

            <div className="reveal-up reveal-delay-3 mt-12 grid max-w-xl grid-cols-3 border-y border-border/80 py-5">
              <div>
                <p className="font-display text-xl font-bold text-primary">100%</p>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">Onchain escrow</p>
              </div>
              <div className="border-x border-border px-5">
                <p className="font-display text-xl font-bold">24/7</p>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">Open network</p>
              </div>
              <div className="pl-5">
                <p className="font-display text-xl font-bold text-secondary">0</p>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">Custodians</p>
              </div>
            </div>
          </div>

          <div className="relative z-10 mx-auto w-full max-w-lg lg:ml-auto">
            <div className="orb orb-magenta pointer-events-none absolute -right-24 -top-28 size-72 rounded-full" />
            <div className="relative rotate-[1.5deg] rounded-lg border border-primary/25 bg-card/85 p-3 shadow-[0_30px_100px_rgba(0,0,0,0.5),0_0_60px_rgba(0,240,255,0.08)] backdrop-blur-xl transition-transform duration-500 hover:rotate-0">
              <div className="flex items-center justify-between rounded-md border border-border bg-background/80 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-secondary" />
                  <span className="size-2 rounded-full bg-[#ffb000]" />
                  <span className="size-2 rounded-full bg-primary" />
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">nexus://bounty/042</span>
              </div>

              <div className="p-5 sm:p-7">
                <div className="flex items-start justify-between gap-5">
                  <div>
                    <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Critical contract review</p>
                    <h2 className="mt-2 text-2xl font-bold leading-tight">Bridge vault exploit bounty</h2>
                  </div>
                  <div className="grid size-11 shrink-0 place-items-center rounded-md border border-secondary/30 bg-secondary/10">
                    <ShieldCheck className="text-secondary" />
                  </div>
                </div>

                <div className="mt-8 rounded-md border border-border bg-background/70 p-5">
                  <div className="flex items-end justify-between">
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Secured reward</span>
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase text-primary">Escrow active</span>
                  </div>
                  <p className="mt-3 font-display text-4xl font-bold tracking-tight">18,500 <span className="text-lg text-primary">BOT</span></p>
                  <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-primary to-secondary shadow-[0_0_16px_rgba(0,240,255,0.5)]" />
                  </div>
                  <div className="mt-3 flex justify-between font-mono text-[10px] uppercase text-muted-foreground">
                    <span>Review window</span>
                    <span>09d : 14h : 26m</span>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {["Scope hash verified", "Reward locked in contract", "Dispute module enabled"].map((item) => (
                    <div key={item} className="flex items-center justify-between border-b border-border/70 pb-3 text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground"><CheckCircle2 className="size-4 text-primary" />{item}</span>
                      <span className="font-mono text-[10px] uppercase text-primary">confirmed</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="absolute -bottom-8 -left-5 flex items-center gap-3 rounded-md border border-secondary/30 bg-[#110714]/95 p-3 shadow-2xl backdrop-blur sm:-left-10">
              <span className="grid size-9 place-items-center rounded-md bg-secondary/15"><Zap className="size-4 text-secondary" /></span>
              <div>
                <p className="text-xs font-bold">Settlement finalized</p>
                <p className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Block #19,840,221</p>
              </div>
            </div>
          </div>
        </section>

        <section id="protocol" className="relative border-y border-border bg-card/35 py-24 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16">
              <div>
                <p className="section-kicker">The protocol</p>
                <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">A cleaner path from vulnerability to resolution.</h2>
                <p className="mt-5 leading-relaxed text-muted-foreground">No opaque payout promises. No scattered evidence. Every critical step is joined into one verifiable lifecycle.</p>
              </div>
              <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
                {steps.map(({ icon: Icon, number, title, text }) => (
                  <article key={number} className="group relative bg-background p-7 transition-colors hover:bg-primary/[0.035]">
                    <div className="flex items-center justify-between">
                      <span className="grid size-10 place-items-center rounded-md border border-primary/20 bg-primary/[0.06] text-primary transition-transform group-hover:-translate-y-1"><Icon className="size-5" /></span>
                      <span className="font-mono text-xs text-muted-foreground">/{number}</span>
                    </div>
                    <h3 className="mt-8 text-lg font-bold">{title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{text}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="network" className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28 lg:px-10">
          <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
            <div className="relative min-h-[430px] overflow-hidden rounded-lg border border-border bg-card/55 p-6">
              <div className="network-grid absolute inset-0 opacity-70" />
              <div className="absolute left-1/2 top-1/2 size-64 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/10" />
              <div className="absolute left-1/2 top-1/2 size-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-secondary/10" />
              <div className="absolute left-1/2 top-1/2 grid size-24 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-primary/50 bg-background shadow-[0_0_55px_rgba(0,240,255,0.22)]">
                <Bot className="size-9 text-primary" />
              </div>
              {[
                ["Researcher", "left-[8%] top-[16%]", "text-primary"],
                ["Escrow", "right-[8%] top-[20%]", "text-secondary"],
                ["Builder", "bottom-[16%] left-[12%]", "text-secondary"],
                ["Arbitrator", "bottom-[14%] right-[6%]", "text-primary"]
              ].map(([label, position, color]) => (
                <div key={label} className={`absolute ${position} rounded-md border border-border bg-background/90 px-3 py-2 text-xs font-bold shadow-xl`}>
                  <span className={`mr-2 inline-block size-1.5 rounded-full bg-current ${color}`} />{label}
                </div>
              ))}
              <p className="absolute bottom-5 left-6 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Live protocol topology / BOT testnet</p>
            </div>

            <div>
              <p className="section-kicker">One shared truth</p>
              <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight sm:text-5xl">Trust the transaction, not the promise.</h2>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground">Builders prove funds are available. Researchers prove when they disclosed. Contracts prove how each bounty resolves.</p>
              <div className="mt-8 space-y-4">
                {guarantees.map((guarantee) => (
                  <div key={guarantee} className="flex items-center gap-3 border-b border-border pb-4">
                    <CheckCircle2 className="size-5 shrink-0 text-primary" />
                    <span className="font-semibold">{guarantee}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="security" className="mx-5 mb-8 overflow-hidden rounded-lg border border-primary/20 bg-card sm:mx-8 lg:mx-auto lg:max-w-[calc(80rem-5rem)]">
          <div className="relative px-6 py-20 text-center sm:px-12 sm:py-24">
            <div className="orb orb-cyan pointer-events-none absolute left-1/2 top-1/2 size-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40" />
            <Sparkles className="relative mx-auto size-7 text-primary" />
            <p className="section-kicker relative mt-5">The next finding matters</p>
            <h2 className="relative mx-auto mt-4 max-w-3xl font-display text-4xl font-bold tracking-tight sm:text-5xl">Make the internet safer. Get paid without the guesswork.</h2>
            <p className="relative mx-auto mt-5 max-w-xl leading-relaxed text-muted-foreground">Enter an open marketplace where security work has transparent terms and rewards are backed by code.</p>
            <Button onClick={openApp} size="lg" className="relative mt-9 h-12 px-7 text-base">Enter NEXUS <ArrowRight /></Button>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-10 text-sm text-muted-foreground sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
        <div className="flex items-center gap-3"><Terminal className="size-4 text-primary" /><span className="font-display font-bold tracking-[0.16em] text-foreground">NEXUS</span><span>/ Secured by BOT Chain</span></div>
        <p>Transparent scope. Protected disclosure. Deterministic payout.</p>
      </footer>
    </div>
  );
}
