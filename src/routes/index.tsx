import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Coins, GraduationCap, Repeat2, Sparkles, Users } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PeerSwap — O‘rgatib o‘rganing" },
      {
        name: "description",
        content:
          "PeerSwap siz bilgan ko‘nikmani o‘rganmoqchi va sizga kerakli ko‘nikmani o‘rgata oladigan hamkorni topadi.",
      },
      { property: "og:title", content: "PeerSwap — O‘rgatib o‘rganing" },
      {
        property: "og:description",
        content: "Ko‘nikma o‘rgating, PeerPoint ishlating va yangi ko‘nikma o‘rganing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const steps = [
  {
    icon: GraduationCap,
    title: "Ko‘nikmalaringizni qo‘shing",
    text: "Nimani o‘rgata olishingiz va nimani o‘rganmoqchi ekaningizni yozing.",
  },
  {
    icon: Users,
    title: "Mos hamkor toping",
    text: "Ko‘nikmalaringizga mos hamkorlarni topamiz va moslik darajasini ko‘rsatamiz.",
  },
  {
    icon: Coins,
    title: "Bilim almashing",
    text: "Mashg‘ulotni yakunlang va hamkoringizni baholang.",
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
            <Link to="/login">Kirish</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/signup">Boshlash</Link>
          </Button>
        </div>
      </header>

      <section className="hero-glow">
        <div className="mx-auto max-w-6xl px-4 pt-16 pb-20 text-center sm:pt-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="size-3 text-accent" />
            O‘zaro ko‘nikma almashish platformasi
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
            <span className="text-brand-gradient">O‘rgatib o‘rganing.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Bilimingizni ulashing. Keraklisini o‘rganing.
          </p>
          <p className="mx-auto mt-6 max-w-lg text-sm text-muted-foreground">
            Ko‘nikma o‘rgating <span className="text-accent">→</span> PeerPoint ishlating{" "}
            <span className="text-accent">→</span> yangi ko‘nikma o‘rganing.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/signup">
                Almashishni boshlash <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#how-it-works">Qanday ishlaydi?</a>
            </Button>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-6xl px-4 pb-20">
        <h2 className="text-center text-2xl font-semibold tracking-tight">Qanday ishlaydi?</h2>
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
            <p className="text-sm text-muted-foreground">Muhammadqodir o‘rgatadi</p>
            <p className="text-lg font-semibold">HTML / Flexbox</p>
          </div>
          <div className="text-center text-2xl text-accent">↔</div>
          <div className="sm:text-right">
            <p className="text-sm text-muted-foreground">Ali o‘rgatadi</p>
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
