import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { AppShell } from "@/components/AppHeader";
import { MatchCard } from "@/components/MatchCard";
import { useAuth, useRequireAuth } from "@/lib/auth";
import { fetchMySessions, fetchProfiles, rankMatches } from "@/lib/peerswap";

export const Route = createFileRoute("/matches")({
  head: () => ({
    meta: [
      { title: "Find Your Match — PeerSwap" },
      { name: "description", content: "Browse peers whose skills complement yours and request a swap." },
      { property: "og:title", content: "Find Your Match — PeerSwap" },
      { property: "og:description", content: "Browse peers whose skills complement yours and request a swap." },
    ],
  }),
  component: MatchesPage,
});

function MatchesPage() {
  const { user } = useRequireAuth();
  const { loading } = useAuth();

  const profilesQuery = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles, enabled: !!user });
  const sessionsQuery = useQuery({
    queryKey: ["sessions", user?.id],
    queryFn: () => fetchMySessions(user!.id),
    enabled: !!user,
  });

  if (loading || !user) return null;

  const profiles = profilesQuery.data ?? [];
  const me = profiles.find((p) => p.id === user.id);
  const matches = me ? rankMatches(me, profiles) : [];
  const sessions = sessionsQuery.data ?? [];
  const requestedIds = new Set(sessions.map((s) => (s.requester_id === user.id ? s.partner_id : s.requester_id)));

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Find Your Match</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Ranked by how well your skills fit together.
      </p>

      {profilesQuery.isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading peers…</p>
      ) : matches.length === 0 ? (
        <div className="surface-card mt-6 p-6 text-sm text-muted-foreground">
          No matches yet. Add skills on your{" "}
          <Link to="/profile" className="text-primary hover:underline">
            profile
          </Link>{" "}
          to unlock recommendations.
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
