import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  Sparkles,
  Video,
  Coins,
  Repeat2,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export function HomeHero() {
  return (
    <section className="relative overflow-hidden hero-glow border-b border-border/40">
      {/* Subtle ambient gradient orbs using theme tokens */}
      <div
        className="pointer-events-none absolute -top-24 left-1/2 -z-10 -translate-x-1/2 h-[420px] w-full max-w-5xl opacity-40 blur-3xl"
        style={{
          background: "var(--gradient-hero)",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-1/3 -left-32 -z-10 size-96 rounded-full opacity-20 blur-3xl"
        style={{
          background: "var(--gradient-brand)",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-1/4 -right-32 -z-10 size-96 rounded-full opacity-15 blur-3xl"
        style={{
          background: "var(--gradient-brand)",
        }}
        aria-hidden="true"
      />

      <div className="mx-auto max-w-6xl px-4 pt-14 pb-20 sm:pt-20 sm:pb-28">
        {/* Value Tag Badge */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/80 backdrop-blur px-3.5 py-1.5 text-xs text-muted-foreground shadow-sm">
            <span className="flex size-5 items-center justify-center rounded-full bg-accent/20 text-accent">
              <Sparkles className="size-3" />
            </span>
            <span>Tengdoshlararo (P2P) bilim almashish ekotizimi</span>
          </div>
        </div>

        {/* Main Headline */}
        <div className="mt-6 text-center">
          <h1 className="mx-auto max-w-4xl text-4xl font-extrabold tracking-tight sm:text-6xl sm:leading-[1.15]">
            Bilganingizni <span className="text-brand-gradient">o‘rgating</span>,
            <br />
            keraklisini <span className="text-brand-gradient">o‘rganing</span>.
          </h1>

          {/* Clear Value Proposition */}
          <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
            Pul to‘lamasdan yangi bilim oling: o‘zingiz yaxshi biladigan sohani boshqaga o‘rgating,
            PeerPoint ballarini to‘plang va kerakli yangi ko‘nikmani jonli video darslarda bepul
            o‘rganing.
          </p>

          {/* Value Flow Pill */}
          <div className="mx-auto mt-6 inline-flex flex-wrap items-center justify-center gap-2 rounded-xl border border-border/60 bg-secondary/50 px-4 py-2 text-xs sm:text-sm text-foreground/90 backdrop-blur">
            <span className="font-medium text-emerald-400">Ko‘nikma o‘rgatasiz</span>
            <span className="text-muted-foreground">→</span>
            <span className="font-semibold text-accent">PeerPoint ishlaysiz</span>
            <span className="text-muted-foreground">→</span>
            <span className="font-medium text-sky-400">Yangi bilim o‘rganasiz</span>
          </div>

          {/* Dedicated 'Learn and Teach' Call-to-Action Buttons */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            {/* Learn Action */}
            <Button
              asChild
              size="lg"
              className="h-12 px-6 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 text-sm font-semibold rounded-xl"
            >
              <Link to="/signup">
                <BookOpen className="size-4" />
                O‘rganishni boshlash
                <ArrowRight className="size-4" />
              </Link>
            </Button>

            {/* Teach Action */}
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 px-6 gap-2 border-accent/40 text-foreground hover:bg-accent/15 hover:border-accent shadow-sm text-sm font-semibold rounded-xl"
            >
              <Link to="/signup">
                <GraduationCap className="size-4 text-accent" />
                O‘rgatishni boshlash
              </Link>
            </Button>
          </div>

          {/* Trust & Feature Badges */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Video className="size-4 text-accent" />
              <span>Jonli video dars va zapis</span>
            </div>
            <div className="flex items-center gap-2">
              <Coins className="size-4 text-accent" />
              <span>1 ta dars = 1 ta PeerPoint</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-accent" />
              <span>Adolatli baholash va tekshiruv</span>
            </div>
          </div>
        </div>

        {/* Live Skill Swap Interactive Mock Card */}
        <div className="mx-auto mt-12 max-w-3xl rounded-2xl border border-border/80 bg-card/60 p-4 sm:p-6 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-border/60 pb-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground flex items-center gap-1.5">
              <Repeat2 className="size-4 text-accent" />
              Haqiqiy o‘zaro almashinuv namunasi
            </span>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 font-medium text-emerald-400 border border-emerald-500/20">
              Faol mashg‘ulot
            </span>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            {/* Side A */}
            <div className="rounded-xl border border-border/50 bg-secondary/40 p-4">
              <p className="text-xs text-muted-foreground font-medium">Muhammadqodir o‘rgatadi</p>
              <p className="text-base font-semibold text-foreground mt-0.5">React & Tailwind CSS</p>
              <p className="text-xs text-emerald-400 mt-1">O‘rganadi: Python / SQL</p>
            </div>

            {/* Swap Indicator */}
            <div className="flex items-center justify-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-secondary border border-border text-accent shadow-sm">
                <Repeat2 className="size-5" />
              </span>
            </div>

            {/* Side B */}
            <div className="rounded-xl border border-border/50 bg-secondary/40 p-4 sm:text-right">
              <p className="text-xs text-muted-foreground font-medium">Ali o‘rgatadi</p>
              <p className="text-base font-semibold text-foreground mt-0.5">
                SQL JOIN & PostgreSQL
              </p>
              <p className="text-xs text-sky-400 mt-1">O‘rganadi: Frontend & UI</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
