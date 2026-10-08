import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Sparkles, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth, useRequireAuth } from "@/lib/auth";
import { fetchWeeklyPoints, updateMyPlan, type Plan } from "@/lib/peerswap";

export const Route = createFileRoute("/subscription")({
  head: () => ({
    meta: [
      { title: "Tariflar va narxlar — PeerSwap" },
      {
        name: "description",
        content:
          "O‘rganishingizga mos PeerSwap tarifini tanlang: Bepul tarifda haftasiga 3, Premiumda 15, Pro tarifida cheksiz PeerPoint.",
      },
      { property: "og:title", content: "Tariflar va narxlar — PeerSwap" },
      {
        property: "og:description",
        content: "Bepul boshlang, ko‘proq imkoniyat kerak bo‘lganda tarifni yangilang.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SubscriptionPage,
});

type PlanCard = {
  id: Plan;
  name: string;
  price: string;
  period?: string;
  label?: string;
  badge?: string;
  points: string;
  features: string[];
  featured?: boolean;
  modalTitle?: string;
  modalBody?: string;
};

const PLANS: PlanCard[] = [
  {
    id: "free",
    name: "BEPUL",
    price: "0 so'm",
    label: "Bepul boshlang",
    points: "Haftasiga 3 PeerPoint",
    features: [
      "Haftasiga 3 PeerPoint",
      "Oddiy ko‘nikma moslashtirish",
      "Hamkorlarni topish",
      "Almashinuv so‘rovlari",
      "Mashg‘ulotni baholash",
      "Asosiy profil",
    ],
  },
  {
    id: "premium",
    name: "PREMIUM",
    price: "29,000 so'm",
    period: "/ oyiga",
    badge: "Eng ommabop",
    points: "Haftasiga 15 PeerPoint",
    features: [
      "Haftasiga 15 PeerPoint",
      "Ustuvor moslashtirish",
      "Cheksiz hamkor qidirish",
      "Almashinuv so‘rovlari",
      "Mashg‘ulotni baholash",
      "Kengaytirilgan ko‘nikma qidiruvi",
    ],
    featured: true,
    modalTitle: "Premium tarifiga o‘tasizmi?",
    modalBody:
      "Har hafta 15 PeerPoint, ustuvor moslashtirish va kengaytirilgan ko‘nikma qidiruviga ega bo‘ling.",
  },
  {
    id: "pro",
    name: "PRO",
    price: "59,000 so'm",
    period: "/ oyiga",
    badge: "Faol foydalanuvchi",
    points: "Cheksiz PeerPoint",
    features: [
      "Cheksiz PeerPoint",
      "Kengaytirilgan moslashtirish",
      "O‘rganish tahlillari",
      "Ko‘nikma rivojini kuzatish",
      "Tasdiqlangan profil",
      "Ko‘nikma sertifikati",
      "Ustuvor yordam",
    ],
    modalTitle: "Pro tarifiga o‘tasizmi?",
    modalBody: "Cheksiz PeerPoint, tahlillar, tasdiqlangan profil va ustuvor yordamga ega bo‘ling.",
  },
];

function SubscriptionPage() {
  const { user } = useRequireAuth();
  const { loading } = useAuth();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<PlanCard | null>(null);
  const [step, setStep] = useState<"confirm" | "done">("confirm");
  const [pending, setPending] = useState(false);

  const pointsQuery = useQuery({
    queryKey: ["weekly-points", user?.id],
    queryFn: () => fetchWeeklyPoints(user!.id),
    enabled: !!user,
  });

  if (loading || !user) return null;

  const points = pointsQuery.data;
  const currentPlan: Plan = points?.plan ?? "free";

  async function applyPlan(plan: Plan) {
    setPending(true);
    try {
      await updateMyPlan(user!.id, plan);
      await queryClient.invalidateQueries({ queryKey: ["weekly-points", user!.id] });
      await queryClient.invalidateQueries({ queryKey: ["profiles"] });
      setStep("done");
    } catch {
      toast.error("Tarifni o‘zgartirib bo‘lmadi. Qayta urinib ko‘ring.");
    } finally {
      setPending(false);
    }
  }

  function usageLine(plan: Plan) {
    if (plan !== currentPlan) {
      return plan === "pro"
        ? "Cheksiz PeerPoint"
        : `Har hafta ${plan === "premium" ? 15 : 3} PeerPoint`;
    }
    if (points?.allowance == null) return "Cheksiz PeerPoint";
    return `${points?.remaining ?? 0} / ${points?.allowance ?? 3} PeerPoint shu hafta mavjud`;
  }

  function buttonLabel(plan: PlanCard) {
    if (plan.id === currentPlan) return "Joriy tarif";
    if (plan.id === "free") return "Bepul tarifga o‘tish";
    return `${plan.name.charAt(0) + plan.name.slice(1).toLowerCase()} tarifiga o‘tish`;
  }

  return (
    <AppShell>
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-4xl">
          O‘rganishingizga mos <span className="text-brand-gradient">tarifni tanlang</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Bepul boshlang, ko‘proq imkoniyat kerak bo‘lganda tarifni yangilang.
        </p>
        {points?.allowance != null ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {points.daysUntilReset} kundan keyin yangilanadi
          </p>
        ) : null}
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          return (
            <div
              key={plan.id}
              className={`surface-card relative flex flex-col p-6 ${
                plan.featured ? "ring-2 ring-primary md:-mt-3 md:pb-9" : ""
              }`}
            >
              {plan.badge ? (
                <span
                  className={`absolute -top-3 right-5 flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                    plan.featured
                      ? "bg-brand-gradient text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {plan.featured ? <Sparkles className="size-3" /> : <Zap className="size-3" />}
                  {plan.badge}
                </span>
              ) : null}

              <h2 className="text-sm font-semibold tracking-widest text-muted-foreground">
                {plan.name}
              </h2>
              <p className="mt-3 text-3xl font-bold">
                {plan.price}
                {plan.period ? (
                  <span className="text-sm font-normal text-muted-foreground"> {plan.period}</span>
                ) : null}
              </p>
              {plan.label ? (
                <p className="mt-1 text-sm text-muted-foreground">{plan.label}</p>
              ) : null}
              <p className="mt-3 text-sm font-medium text-accent">{plan.points}</p>
              <p className="mt-1 text-xs text-muted-foreground">{usageLine(plan.id)}</p>

              <ul className="mt-5 flex-1 space-y-2 text-sm text-muted-foreground">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-accent" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="mt-6"
                variant={isCurrent ? "outline" : plan.featured ? "default" : "secondary"}
                disabled={isCurrent}
                onClick={() => {
                  if (plan.id === "free") {
                    void applyPlan("free");
                    toast.success("Bepul tarifga o‘tdingiz — haftasiga 3 PeerPoint.");
                    return;
                  }
                  setStep("confirm");
                  setSelected(plan);
                }}
              >
                {buttonLabel(plan)}
              </Button>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Bu sinov talqini — to‘lov olinmaydi. Tarif o‘zgartirilganda haftalik PeerPointlaringiz
        darhol yangilanadi.
      </p>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          {step === "confirm" ? (
            <>
              <DialogHeader>
                <DialogTitle>{selected?.modalTitle}</DialogTitle>
                <DialogDescription>{selected?.modalBody}</DialogDescription>
              </DialogHeader>
              <p className="text-2xl font-bold">
                {selected?.price}
                <span className="text-sm font-normal text-muted-foreground"> / oyiga</span>
              </p>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setSelected(null)}>
                  Bekor qilish
                </Button>
                <Button disabled={pending} onClick={() => selected && void applyPlan(selected.id)}>
                  {pending ? "Kuting…" : "Davom etish"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Tez orada</DialogTitle>
                <DialogDescription>
                  To‘lovlar tez orada ishga tushadi. Qiziqishingiz qayd etildi va tarifingiz ushbu
                  demo uchun faollashtirildi.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={() => setSelected(null)}>Yopish</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
