import { useEffect } from "react";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  Code2,
  LockKeyhole,
  Radar,
  ShieldCheck,
  Sparkles,
  Terminal,
  Zap
} from "lucide-react";

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

export default function HomePage({ openApp }: { openApp: (destination?: "business" | "researcher") => void }) {
  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -48px" }
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="nexus-page min-h-screen overflow-hidden bg-background text-foreground">
      {/* ---- HEADER ---- */}
      <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <a href="/" className="nexus-nav flex items-center gap-2" aria-label="BugChain home">
          <ShieldCheck className="size-5 text-primary" />
          <span className="font-bold tracking-[0.18em] text-foreground">BugChain</span>
        </a>

        <nav className="nexus-nav hidden items-center gap-8 text-muted-foreground md:flex" aria-label="Primary navigation">
          <a className="hover:text-primary" href="#protocol">PROTOCOL</a>
          <a className="hover:text-primary" href="#network">NETWORK</a>
          <a className="hover:text-primary" href="#security">SECURITY</a>
        </nav>

        <button onClick={() => openApp()} className="login-btn">OPEN APP</button>
      </header>

      {/* ---- HERO ---- */}
      <main>
        <section className="relative mx-auto min-h-[680px] max-w-7xl px-5 pb-24 pt-12 sm:px-8 lg:px-10">
          <div className="relative z-10 grid items-center gap-14 pt-8 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
            <div>
              <p className="form-section-label reveal-up">Bug bounty infrastructure / BOT Chain</p>
              <h1 className="pixel-title reveal-up reveal-delay-1 mt-5">
                SECURITY<br />
                <span className="accent">WITHOUT GUESSWORK.</span>
              </h1>
              <p className="reveal-up reveal-delay-2 mt-8 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                BugChain is the transparent bug bounty protocol for builders and researchers. Fund the reward, disclose responsibly, and resolve every finding through verifiable onchain escrow.
              </p>
              <div className="reveal-up reveal-delay-3 mt-10">
                <button onClick={() => openApp()} className="login-btn">
                  ENTER THE PROTOCOL <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-lg lg:ml-auto">
              <div className="pointer-events-none absolute -right-24 -top-28 size-72 rounded-full bg-secondary/10 blur-[85px]" />
              <div className="relative rotate-[1.5deg] rounded-lg border border-primary/25 bg-card/85 p-3 shadow-2xl backdrop-blur-xl transition-transform duration-500 hover:rotate-0">
                <div className="flex items-center justify-between rounded-md border border-border bg-background/80 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-secondary" />
                    <span className="size-2 rounded-full bg-secondary/60" />
                    <span className="size-2 rounded-full bg-primary" />
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">bugchain://bounty/042</span>
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
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Secured reward</span>
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase text-primary">Escrow active</span>
                    </div>
                    <p className="mt-3 text-4xl font-bold tracking-tight">18,500 <span className="text-lg text-primary">BOT</span></p>
                    <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-[#ff4da6] to-secondary" />
                    </div>
                    <div className="mt-3 flex justify-between font-mono text-[10px] uppercase text-muted-foreground">
                      <span>Review window</span>
                      <span>09d : 14h : 26m</span>
                    </div>
                  </div>

                  <div className="mt-6 space-y-3">
                    {["Scope hash verified", "Reward locked in contract", "Dispute module enabled"].map((item) => (
                      <div key={item} className="flex items-center justify-between gap-4 border-b border-border/70 pb-3 text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground"><CheckCircle2 className="size-4 shrink-0 text-primary" />{item}</span>
                        <span className="shrink-0 font-mono text-[10px] uppercase text-primary">confirmed</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-8 -left-3 flex items-center gap-3 rounded-md border border-secondary/30 bg-card/95 p-3 shadow-xl backdrop-blur sm:-left-8">
                <span className="grid size-9 place-items-center rounded-md bg-secondary/15"><Zap className="size-4 text-secondary" /></span>
                <div>
                  <p className="text-xs font-bold">Settlement finalized</p>
                  <p className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Block #19,840,221</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---- PROTOCOL STEPS ---- */}
        <section id="protocol" className="relative border-y border-border bg-card/35 py-24 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16">
              <div data-reveal>
                <p className="form-section-label">The protocol</p>
                <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">A cleaner path from vulnerability to resolution.</h2>
                <p className="mt-5 leading-relaxed text-muted-foreground">No opaque payout promises. No scattered evidence. Every critical step is joined into one verifiable lifecycle.</p>
              </div>
              <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
                {steps.map(({ icon: Icon, number, title, text }) => (
                  <article
                    key={number}
                    data-reveal
                    style={{ transitionDelay: `${Number(number) * 70}ms` }}
                    className="group relative bg-background p-7 transition-colors hover:bg-primary/[0.035]"
                  >
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

        {/* ---- NETWORK ---- */}
        <section id="network" className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28 lg:px-10">
          <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
            <div data-reveal className="relative min-h-[430px] overflow-hidden rounded-lg border border-border bg-card/55 p-6">
              <div className="absolute left-1/2 top-1/2 size-64 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/10" />
              <div className="absolute left-1/2 top-1/2 size-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-secondary/10" />
              <div className="absolute left-1/2 top-1/2 grid size-24 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-primary/50 bg-background shadow-md">
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

            <div data-reveal data-reveal-direction="right">
              <p className="form-section-label">One shared truth</p>
              <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-5xl">Trust the transaction, not the promise.</h2>
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

        {/* ---- SECURITY CTA ---- */}
        <section data-reveal id="security" className="mx-5 mb-8 overflow-hidden rounded-lg border border-primary/20 bg-card sm:mx-8 lg:mx-auto lg:max-w-[calc(80rem-5rem)]">
          <div className="relative px-6 py-20 text-center sm:px-12 sm:py-24">
            <Sparkles className="relative mx-auto size-7 text-primary" />
            <p className="form-section-label relative mt-5">The next finding matters</p>
            <h2 className="relative mx-auto mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">Make the internet safer. Get paid without the guesswork.</h2>
            <p className="relative mx-auto mt-5 max-w-xl leading-relaxed text-muted-foreground">Enter an open marketplace where security work has transparent terms and rewards are backed by code.</p>
            <div className="relative mt-9 flex flex-wrap justify-center gap-3">
              <button onClick={() => openApp("business")} className="login-btn">CREATE A BOUNTY <ArrowRight className="ml-2 inline size-4" /></button>
              <button onClick={() => openApp("researcher")} className="login-btn">EXPLORE BOUNTIES</button>
            </div>
          </div>
        </section>
      </main>

      {/* ---- FOOTER ---- */}
      <footer className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-10 text-sm text-muted-foreground sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
        <div className="flex items-center gap-3">
          <Terminal className="size-4 text-primary" />
          <span className="font-bold tracking-[0.16em] text-foreground">BugChain</span>
          <span>/ Secured by BOT Chain</span>
        </div>
        <p>Transparent scope. Protected disclosure. Deterministic payout.</p>
      </footer>
    </div>
  );
}
