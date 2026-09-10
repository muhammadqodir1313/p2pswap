import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Coins, GraduationCap, Lightbulb, CheckCircle2 } from "lucide-react";

import { AppShell } from "@/components/AppHeader";
import { MatchCard } from "@/components/MatchCard";
import { Button } from "@/components/ui/button";
import { useAuth, useRequireAuth } from "@/lib/auth";
import { fetchMySessions, fetchProfiles, rankMatches } from "@/lib/peerswap";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — PeerSwap" },
      { name: "description", content: "Your PeerCoin balance, skills and recommended skill-swap matches." },
      { property: "og:title", content: "Dashboard — PeerSwap" },
      { property: "og:description", content: "Your PeerCoin balance, skills and recommended matches." },
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

  if (loading || !user) return null;

  const profiles = profilesQuery.data ?? [];
  const me = profiles.find((p) => p.id === user.id);
  const sessions = sessionsQuery.data ?? [];
  const completed = sessions.filter((s) => s.status === "completed").length;
  const matches = me ? rankMatches(me, profiles).slice(0, 5) : [];
  const requestedIds = new Set(sessions.map((s) => (s.requester_id === user.id ? s.partner_id : s.requester_id)));

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Hello, {me?.first_name || "there"} 👋
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Here is your swap activity today.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="surface-card bg-brand-gradient p-5 text-primary-foreground">
          <Coins className="size-5" />
          <p className="mt-3 text-3xl font-bold">{me?.peercoins ?? 0}</p>
          <p className="text-sm opacity-80">PeerCoin</p>
        </div>
        <Stat icon={GraduationCap} label="Skills I Teach" value={me?.teach.length ?? 0} />
        <Stat icon={Lightbulb} label="Skills I Want" value={me?.learn.length ?? 0} />
        <Stat icon={CheckCircle2} label="Completed Sessions" value={completed} />
      </div>

      <div className="mt-10 flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold tracking-tight">Your Potential Matches</h2>
        <Button asChild variant="outline" size="sm">
          <Link to="/matches">Find Match</Link>
        </Button>
      </div>

      {profilesQuery.isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading matches…</p>
      ) : matches.length === 0 ? (
        <div className="surface-card mt-4 p-6 text-sm text-muted-foreground">
          Add the skills you can teach and want to learn on your{" "}
          <Link to="/profile" className="text-primary hover:underline">
            profile
          </Link>{" "}
          to see matches.
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
