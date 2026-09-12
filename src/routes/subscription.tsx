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
      { title: "Subscription Plans & Pricing — PeerSwap" },
      {
        name: "description",
        content:
          "Choose the PeerSwap plan that fits your learning: Free with 3 PeerPoints a week, Premium with 15, or Pro with unlimited PeerPoints.",
      },
      { property: "og:title", content: "Subscription Plans & Pricing — PeerSwap" },
      {
        property: "og:description",
        content:
          "Start free, upgrade when you need more. Compare Free, Premium and Pro PeerPoint allowances on PeerSwap.",
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
    name: "FREE",
    price: "0 so'm",
    label: "Start for free",
    points: "3 PeerPoints / week",
    features: [
      "3 PeerPoints per week",
      "Basic skill matching",
      "Find peers",
      "Swap requests",
      "Session feedback",
      "Basic profile",
    ],
  },
  {
    id: "premium",
    name: "PREMIUM",
    price: "29,000 so'm",
    period: "/ month",
    badge: "Most Popular",
    points: "15 PeerPoints / week",
    features: [
      "15 PeerPoints per week",
      "Priority matching",
      "Unlimited peer discovery",
      "Swap requests",
      "Session feedback",
      "Advanced skill discovery",
    ],
    featured: true,
    modalTitle: "Upgrade to Premium?",
    modalBody:
      "Get 15 PeerPoints every week plus priority matching and advanced skill discovery.",
  },
  {
    id: "pro",
    name: "PRO",
    price: "59,000 so'm",
    period: "/ month",
    badge: "Power User",
    points: "Unlimited PeerPoints",
    features: [
      "Unlimited PeerPoints",
      "Advanced matching",
      "Learning analytics",
      "Skill progress tracking",
      "Verified profile",
      "Skill certificate",
      "Priority support",
    ],
    modalTitle: "Upgrade to Pro?",
    modalBody: "Unlock unlimited PeerPoints, analytics, verified profile and priority support.",
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
      toast.error("Could not change your plan. Please try again.");
    } finally {
      setPending(false);
    }
  }

  function usageLine(plan: Plan) {
    if (plan !== currentPlan) {
      return plan === "pro"
        ? "Unlimited PeerPoints"
        : `${plan === "premium" ? 15 : 3} PeerPoints every week`;
    }
    if (points?.allowance == null) return "Unlimited PeerPoints";
    return `${points?.remaining ?? 0} / ${points?.allowance ?? 3} PeerPoints available this week`;
  }

  function buttonLabel(plan: PlanCard) {
    if (plan.id === currentPlan) return "Current Plan";
    if (plan.id === "free") return "Downgrade";
    return `Upgrade to ${plan.name.charAt(0) + plan.name.slice(1).toLowerCase()}`;
  }

  return (
    <AppShell>
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-4xl">
          Choose the plan that fits your <span className="text-brand-gradient">learning</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Start free, upgrade when you need more.
        </p>
        {points?.allowance != null ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Resets in {points.daysUntilReset} {points.daysUntilReset === 1 ? "day" : "days"}
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
                    toast.success("You're back on the Free plan — 3 PeerPoints per week.");
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
        This is an MVP — no payment is processed. Plan changes update your weekly PeerPoints right
        away.
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
                <span className="text-sm font-normal text-muted-foreground"> / month</span>
              </p>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setSelected(null)}>
                  Cancel
                </Button>
                <Button
                  disabled={pending}
                  onClick={() => selected && void applyPlan(selected.id)}
                >
                  {pending ? "Please wait…" : "Continue"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Coming soon</DialogTitle>
                <DialogDescription>
                  Payments will be available soon. Your interest has been recorded and your plan is
                  active for this demo.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={() => setSelected(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
