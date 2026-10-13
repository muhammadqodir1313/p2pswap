import { createFileRoute, Link } from "@tanstack/react-router";
import { Coins, GraduationCap, Repeat2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FaqSection } from "@/components/FaqSection";
import { HomeHero } from "@/components/HomeHero";
import { TestimonialsSection } from "@/components/TestimonialsSection";

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
    title: "1. Ko‘nikmalaringizni kiriting",
    text: "Nimani mukammal o‘rgata olasiz va nimani o‘rganishni istaysiz — profilda belgilang.",
  },
  {
    icon: Users,
    title: "2. Mos hamkor bilan bog‘laning",
    text: "Tizim avtomatik tarzda o‘zaro mos hamkorlarni topadi va kalendarda dars vaqtini rejalashtirasiz.",
  },
  {
    icon: Coins,
    title: "3. Jonli dars va bilim almashish",
    text: "Video dars orqali bilim ulashing, PeerPoint ishlab oling va o‘zingiz istagan sohani o‘rganing.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen">
      {/* Navigation Header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 border-b border-border/40">
        <Link
          to="/"
          className="flex items-center gap-2 font-semibold hover:opacity-90 transition-opacity"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-gradient text-primary-foreground shadow-sm">
            <Repeat2 className="size-4" />
          </span>
          <span className="text-lg tracking-tight font-bold">PeerSwap</span>
        </Link>
        <div className="flex items-center gap-3">
          <nav className="hidden md:flex items-center gap-4 text-xs font-medium text-muted-foreground mr-2">
            <a href="#how-it-works" className="hover:text-foreground transition-colors">
              Qanday ishlaydi?
            </a>
            <a href="#faq" className="hover:text-foreground transition-colors">
              Savol-javoblar
            </a>
          </nav>
          <Button asChild variant="ghost" size="sm">
            <Link to="/login">Kirish</Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Link to="/signup">Ro‘yxatdan o‘tish</Link>
          </Button>
        </div>
      </header>

      {/* Hero Component */}
      <HomeHero />

      {/* How it works section */}
      <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-20">
        <div className="text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-accent">
            Oddiy va tushunarli jarayon
          </span>
          <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            PeerSwap qanday ishlaydi?
          </h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-xl mx-auto">
            Hech qanday to‘lovlarsiz, 100% o‘zaro tajriba va bilim almashishga asoslangan 3 qadamli
            tizim.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {steps.map((step) => (
            <div key={step.title} className="surface-card p-6 flex flex-col justify-between">
              <div>
                <span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-accent border border-border/60">
                  <step.icon className="size-5" />
                </span>
                <h3 className="mt-5 text-base font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{step.text}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Community Banner */}
        <div className="surface-card mt-12 p-8 text-center sm:text-left sm:flex sm:items-center sm:justify-between gap-6 border-accent/30 bg-gradient-to-r from-card to-secondary/40">
          <div>
            <h3 className="text-xl font-bold tracking-tight">
              O‘rganishga va o‘rgatishga tayyormisiz?
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Hozir ro‘yxatdan o‘ting va boshlang‘ich 10 PeerPoint bonusini oling.
            </p>
          </div>
          <div className="mt-4 sm:mt-0 shrink-0">
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90">
              <Link to="/signup">Bepul boshlash</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* User Testimonials Section */}
      <TestimonialsSection />

      {/* FAQ Section */}
      <FaqSection />

      {/* Footer */}
      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} PeerSwap. Bilim almashish erkinligi.</p>
          <div className="flex items-center gap-4 text-xs">
            <a href="#faq" className="hover:underline">
              Savol-javoblar (FAQ)
            </a>
            <Link to="/signup" className="hover:underline">
              Ro‘yxatdan o‘tish
            </Link>
            <Link to="/login" className="hover:underline">
              Kirish
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
