import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { useAuth, useRequireAuth } from "@/lib/auth";
import { fetchWeeklyPoints, updateMyPlan, type Plan } from "@/lib/peerswap";

export const Route = createFileRoute("/plans")({
  head: () => ({
    meta: [
      { title: "Plans & PeerPoints — PeerSwap" },
      {
        name: "description",
        content: "Compare the Free, Premium and Pro PeerSwap plans and switch your weekly PeerPoint allowance.",
      },
      { property: "og:title", content: "Plans & PeerPoints — PeerSwap" },
      {
        property: "og:description",
        content: "Compare the Free, Premium and Pro PeerSwap plans and switch your weekly PeerPoint allowance.",
      },
    ],
  }),
  component: PlansPage,
});

type PlanCard = {
  id: Plan;
  name: string;
  price: string;
  headline: string;
  features: string[];
  featured?: boolean;
};

const PLANS: PlanCard[] = [
  {
    id: "free",
    name: "Free",
    price: "€0",
    headline: "3 PeerPoints per week",
    features: ["3 swap requests every week", "Two-way skill matching", "Sessions & star ratings"],
  },
  {
    id: "premium",
    name: "Premium",
    price: "€5",
    headline: "15 PeerPoints per week",
    features: ["15 swap requests every week", "Everything in Free", "Priority position in match lists"],
    featured: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: "€12",
    headline: "Unlimited PeerPoints",
    features: ["Unlimited swap requests", "Everything in Premium", "No weekly reset to wait for"],
  },
];

function PlansPage() {
  const { user } = useRequireAuth();
  const { loading } = useAuth();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Plan | null>(null);

  const pointsQuery = useQuery({
    queryKey: ["weekly-points", user?.id],
    queryFn: () => fetchWeeklyPoints(user!.id),
    enabled: !!user,
  });

  if (loading || !user) return null;

  const points = pointsQuery.data;
  const currentPlan = points?.plan ?? "free";

  async function choose(plan: Plan) {
    if (plan === currentPlan) return;
    setPending(plan);
    try {
      await updateMyPlan(user!.id, plan);
      await queryClient.invalidateQueries({ queryKey: ["weekly-points", user!.id] });
      await queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success(
        plan === "pro"
          ? "You're on Pro — unlimited PeerPoints."
          : `You're on ${plan === "premium" ? "Premium" : "Free"} — ${plan === "premium" ? 15 : 3} PeerPoints per week.`,
      );
    } catch {
      toast.error("Could not change your plan. Please try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Plans & PeerPoints</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Pick the weekly PeerPoint allowance that fits how often you swap. Changes apply instantly.
      </p>

      <div className="surface-card mt-6 flex flex-wrap items-center gap-x-6 gap-y-1 p-5">
        <div>
          <p className="text-sm text-muted-foreground">Current plan</p>
          <p className="text-lg font-semibold capitalize">{currentPlan}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">This week</p>
          <p className="text-lg font-semibold">
            {points?.allowance == null && points
              ? "Unlimited PeerPoints"
              : `${points?.remaining ?? 0} / ${points?.allowance ?? 3} PeerPoints`}
          </p>
        </div>
        {points?.allowance != null ? (
          <div>
            <p className="text-sm text-muted-foreground">Resets in</p>
            <p className="text-lg font-semibold">
              {points.daysUntilReset} {points.daysUntilReset === 1 ? "day" : "days"}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          return (
            <div
              key={plan.id}
              className={`surface-card flex flex-col p-6 ${plan.featured ? "ring-1 ring-primary/60" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">{plan.name}</h2>
                {plan.featured ? (
                  <span className="flex items-center gap-1 rounded-full bg-brand-gradient px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
                    <Sparkles className="size-3" /> Popular
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-3xl font-bold">
                {plan.price}
                <span className="text-sm font-normal text-muted-foreground"> / month</span>
              </p>
              <p className="mt-1 text-sm text-accent">{plan.headline}</p>

              <ul className="mt-4 flex-1 space-y-2 text-sm text-muted-foreground">
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
                disabled={isCurrent || pending !== null}
                onClick={() => void choose(plan.id)}
              >
                {isCurrent
                  ? "Current plan"
                  : pending === plan.id
                    ? "Switching…"
                    : plan.id === "free"
                      ? "Switch to Free"
                      : `Upgrade to ${plan.name}`}
              </Button>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        This demo does not process payments — switching a plan updates your weekly PeerPoint allowance right away.
      </p>
    </AppShell>
  );
}
