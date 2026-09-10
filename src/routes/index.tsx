import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Coins, GraduationCap, Repeat2, Sparkles, Users } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PeerSwap — Learn by Teaching" },
      {
        name: "description",
        content:
          "PeerSwap matches you with a peer who wants to learn what you know and can teach what you need. Teach a skill, earn PeerCoin, learn another.",
      },
      { property: "og:title", content: "PeerSwap — Learn by Teaching" },
      {
        property: "og:description",
        content: "Teach a skill, earn PeerCoin, learn another skill. Peer-to-peer micro-skill exchange.",
      },
    ],
  }),
  component: Landing,
});

const steps = [
  {
    icon: GraduationCap,
    title: "Add your skills",
    text: "List what you can teach and what you want to learn.",
  },
  {
    icon: Users,
    title: "Get matched",
    text: "We find peers whose skills mirror yours and show a match score.",
  },
  {
    icon: Coins,
    title: "Swap and earn",
    text: "Complete a session, earn 10 PeerCoin, and rate your peer.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-gradient text-primary-foreground">
            <Repeat2 className="size-4" />
          </span>
          <span className="text-lg tracking-tight">PeerSwap</span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/login">Log in</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/signup">Start Swapping</Link>
          </Button>
        </div>
      </header>

      <section className="hero-glow">
        <div className="mx-auto max-w-6xl px-4 pt-16 pb-20 text-center sm:pt-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="size-3 text-accent" />
            Peer-to-peer micro-skill exchange
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
            <span className="text-brand-gradient">Learn by Teaching.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Share what you know. Learn what you need.
          </p>
          <p className="mx-auto mt-6 max-w-lg text-sm text-muted-foreground">
            Teach a skill <span className="text-accent">→</span> earn PeerCoin{" "}
            <span className="text-accent">→</span> learn another skill.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/signup">
                Start Swapping <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#how-it-works">How It Works</a>
            </Button>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-6xl px-4 pb-20">
        <h2 className="text-center text-2xl font-semibold tracking-tight">How It Works</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {steps.map((step) => (
            <div key={step.title} className="surface-card p-6">
              <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-accent">
                <step.icon className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.text}</p>
            </div>
          ))}
        </div>

        <div className="surface-card mt-10 grid gap-6 p-8 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <div>
            <p className="text-sm text-muted-foreground">Muhammadqodir teaches</p>
            <p className="text-lg font-semibold">HTML / Flexbox</p>
          </div>
          <div className="text-center text-2xl text-accent">↔</div>
          <div className="sm:text-right">
            <p className="text-sm text-muted-foreground">Ali teaches</p>
            <p className="text-lg font-semibold">SQL JOIN</p>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} PeerSwap
      </footer>
    </div>
  );
}
