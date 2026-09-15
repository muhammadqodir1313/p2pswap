import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Coins, GraduationCap, Lightbulb, CheckCircle2 } from "lucide-react";

import { AppShell } from "@/components/AppHeader";
import { MatchCard } from "@/components/MatchCard";
import { Button } from "@/components/ui/button";
import { useAuth, useRequireAuth } from "@/lib/auth";
import { fetchMySessions, fetchProfiles, fetchWeeklyPoints, rankMatches } from "@/lib/peerswap";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Bosh sahifa — PeerSwap" },
      { name: "description", content: "Haftalik PeerPointlar, ko‘nikmalar va tavsiya etilgan hamkorlar." },
      { property: "og:title", content: "Bosh sahifa — PeerSwap" },
      { property: "og:description", content: "Haftalik PeerPointlar, ko‘nikmalar va tavsiya etilgan hamkorlar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useRequireAuth();
  const { loading } = useAuth();

  const profilesQuery = useQuery({
    queryKey: ["profiles"],
    queryFn: fetchProfiles,
    enabled: !!user,
  });
  const sessionsQuery = useQuery({
    queryKey: ["sessions", user?.id],
    queryFn: () => fetchMySessions(user!.id),
    enabled: !!user,
  });
  const pointsQuery = useQuery({
    queryKey: ["weekly-points", user?.id],
    queryFn: () => fetchWeeklyPoints(user!.id),
    enabled: !!user,
  });

  if (loading || !user) return null;

  const profiles = profilesQuery.data ?? [];
  const me = profiles.find((p) => p.id === user.id);
  const sessions = sessionsQuery.data ?? [];
  const completed = sessions.filter((s) => s.status === "completed").length;
  const matches = me ? rankMatches(me, profiles).slice(0, 5) : [];
  const requestedIds = new Set(sessions.map((s) => (s.requester_id === user.id ? s.partner_id : s.requester_id)));
  const points = pointsQuery.data;
  const isUnlimited = points?.allowance == null && points != null;
  const remaining = points?.remaining ?? null;
  const allowance = points?.allowance ?? 3;
  const plan = points?.plan ?? "free";
  const days = points?.daysUntilReset ?? 7;

  function refreshAfterRequest() {
    void sessionsQuery.refetch();
    void pointsQuery.refetch();
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Salom, {me?.first_name || "do‘stim"} 👋
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Bugungi almashinuv faolligingiz.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="surface-card bg-brand-gradient p-5 text-primary-foreground">
          <Coins className="size-5" />
          <p className="mt-3 text-sm font-medium opacity-90">
            PeerPointlar · {plan === "pro" ? "Pro" : plan === "premium" ? "Premium" : "Bepul"} tarif
          </p>
          <p className="mt-1 text-2xl font-bold">
            {isUnlimited
              ? "Cheksiz PeerPoint"
              : `${remaining} / ${allowance} PeerPoint shu hafta`}
          </p>
          {!isUnlimited ? (
            <p className="text-sm opacity-80">
              {days} kundan keyin yangilanadi
            </p>
          ) : null}
          {!isUnlimited && remaining === 0 ? (
            <p className="mt-2 text-xs opacity-90">
              Bu haftadagi barcha {allowance} PeerPoint ishlatildi. Ular keyingi hafta tiklanadi.
            </p>
          ) : null}
          {!isUnlimited ? (
            <Link to="/subscription" className="mt-3 inline-block text-xs font-medium underline opacity-90">
              Tarifni yangilash
            </Link>
          ) : null}
        </div>
        <Stat icon={GraduationCap} label="O‘rgatadigan ko‘nikmalarim" value={me?.teach.length ?? 0} />
        <Stat icon={Lightbulb} label="O‘rganmoqchi bo‘lganlarim" value={me?.learn.length ?? 0} />
        <Stat icon={CheckCircle2} label="Yakunlangan mashg‘ulotlar" value={completed} />
      </div>


      <div className="mt-10 flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold tracking-tight">Sizga mos hamkorlar</h2>
        <Button asChild variant="outline" size="sm">
          <Link to="/matches">Hamkor topish</Link>
        </Button>
      </div>

      {profilesQuery.isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Mos hamkorlar yuklanmoqda…</p>
      ) : matches.length === 0 ? (
        <div className="surface-card mt-4 p-6 text-sm text-muted-foreground">
          Mos hamkorlarni ko‘rish uchun o‘rgata oladigan va o‘rganmoqchi bo‘lgan ko‘nikmalaringizni{" "}
          <Link to="/profile" className="text-primary hover:underline">
            profilingizga
          </Link>{" "}
          qo‘shing.
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {matches.map((m) => (
            <MatchCard
              key={m.profile.id}
              profile={m.profile}
              match={m.match}
              meId={user.id}
              alreadyRequested={requestedIds.has(m.profile.id)}
              pointsLeft={isUnlimited ? null : (remaining ?? 0)}
              onRequested={() => sessionsQuery.refetch()}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="surface-card p-5">
      <Icon className="size-5 text-accent" />
      <p className="mt-3 text-3xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
