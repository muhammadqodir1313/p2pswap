import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

import { AiMatchFinder } from "@/components/AiMatchFinder";
import { AppShell } from "@/components/AppHeader";
import { MatchCard } from "@/components/MatchCard";
import {
  SkillSearchFilter,
  SKILL_CATEGORIES,
  type FilterMode,
  type SortOption,
} from "@/components/SkillSearchFilter";
import { Button } from "@/components/ui/button";
import { useAuth, useRequireAuth } from "@/lib/auth";
import {
  fetchMySessions,
  fetchProfiles,
  fetchWeeklyPoints,
  fullName,
  matchScore,
} from "@/lib/peerswap";

export const Route = createFileRoute("/matches")({
  head: () => ({
    meta: [
      { title: "Hamkor topish — PeerSwap" },
      {
        name: "description",
        content: "Ko‘nikmalaringizga mos hamkorlarni toping va almashinuv so‘rovini yuboring.",
      },
      { property: "og:title", content: "Hamkor topish — PeerSwap" },
      {
        property: "og:description",
        content: "Ko‘nikmalaringizga mos hamkorlarni toping va almashinuv so‘rovini yuboring.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MatchesPage,
});

function MatchesPage() {
  const { user } = useRequireAuth();
  const { loading } = useAuth();
  const userId = user?.uid ?? "";

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [sortBy, setSortBy] = useState<SortOption>("match");

  const profilesQuery = useQuery({
    queryKey: ["profiles"],
    queryFn: fetchProfiles,
    enabled: !!user,
  });
  const sessionsQuery = useQuery({
    queryKey: ["sessions", userId],
    queryFn: () => fetchMySessions(userId),
    enabled: !!user,
  });
  const pointsQuery = useQuery({
    queryKey: ["weekly-points", userId],
    queryFn: () => fetchWeeklyPoints(userId),
    enabled: !!user,
  });

  const profiles = useMemo(() => profilesQuery.data ?? [], [profilesQuery.data]);
  const me = useMemo(() => profiles.find((p) => p.id === userId), [profiles, userId]);
  const sessions = useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data]);
  const requestedIds = useMemo(
    () => new Set(sessions.map((s) => (s.requester_id === userId ? s.partner_id : s.requester_id))),
    [sessions, userId],
  );

  const filteredMatches = useMemo(() => {
    if (!user) return [];
    const otherProfiles = profiles.filter((p) => p.id !== user.id && p.is_active);

    const norm = (s: string) => s.trim().toLowerCase();
    const query = searchQuery.trim().toLowerCase();
    const activeCat = SKILL_CATEGORIES.find((c) => c.id === selectedCategory);

    return otherProfiles
      .map((p) => {
        const match = me
          ? matchScore(me, p)
          : {
              score: 0,
              label: "Moslik yo‘q",
              iTeach: [],
              theyTeach: [],
            };
        return { profile: p, match };
      })
      .filter(({ profile: p, match }) => {
        // Mode filter: mutual
        if (filterMode === "mutual" && match.score === 0) {
          return false;
        }

        // Category filter
        if (activeCat && activeCat.id !== "all") {
          const catKeywords = activeCat.keywords.map(norm);
          const hasTeachCat = p.teach.some((t) =>
            catKeywords.some((kw) => norm(t).includes(kw) || kw.includes(norm(t))),
          );
          const hasLearnCat = p.learn.some((l) =>
            catKeywords.some((kw) => norm(l).includes(kw) || kw.includes(norm(l))),
          );

          if (filterMode === "teach" && !hasTeachCat) return false;
          if (filterMode === "learn" && !hasLearnCat) return false;
          if (filterMode === "all" && !hasTeachCat && !hasLearnCat) return false;
        }

        // Search Query filter
        if (query) {
          const nameMatches =
            p.first_name.toLowerCase().includes(query) ||
            p.last_name.toLowerCase().includes(query) ||
            `${p.first_name} ${p.last_name}`.toLowerCase().includes(query);
          const bioMatches = p.bio?.toLowerCase().includes(query) ?? false;
          const teachMatches = p.teach.some((t) => norm(t).includes(query));
          const learnMatches = p.learn.some((l) => norm(l).includes(query));

          if (filterMode === "teach" && !teachMatches) return false;
          if (filterMode === "learn" && !learnMatches) return false;
          if (
            filterMode === "all" &&
            !teachMatches &&
            !learnMatches &&
            !nameMatches &&
            !bioMatches
          ) {
            return false;
          }
        } else {
          // If no query but teach/learn filter mode is selected
          if (filterMode === "teach" && p.teach.length === 0) return false;
          if (filterMode === "learn" && p.learn.length === 0) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "match") {
          if (b.match.score !== a.match.score) {
            return b.match.score - a.match.score;
          }
          const aTotalSkills = a.profile.teach.length + a.profile.learn.length;
          const bTotalSkills = b.profile.teach.length + b.profile.learn.length;
          return bTotalSkills - aTotalSkills;
        }
        if (sortBy === "skills") {
          const aTotalSkills = a.profile.teach.length + a.profile.learn.length;
          const bTotalSkills = b.profile.teach.length + b.profile.learn.length;
          return bTotalSkills - aTotalSkills;
        }
        if (sortBy === "name") {
          return fullName(a.profile).localeCompare(fullName(b.profile), "uz");
        }
        return 0;
      });
  }, [profiles, user, searchQuery, selectedCategory, filterMode, sortBy, me]);

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setFilterMode("all");
    setSortBy("match");
  };

  if (loading || !user) return null;

  const hasActiveFilters =
    searchQuery.trim().length > 0 || selectedCategory !== "all" || filterMode !== "all";

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Hamkor topish</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ko‘nikmalaringiz bo‘yicha mos hamkorlarni qidiring, toifalarga ajrating va bilim
            almashishni boshlang.
          </p>
        </div>
      </div>

      <AiMatchFinder
        me={me}
        profiles={profiles}
        requestedIds={requestedIds}
        pointsLeft={pointsQuery.data?.remaining ?? null}
        onRequested={() => {
          void sessionsQuery.refetch();
          void pointsQuery.refetch();
        }}
      />

      {/* Skill Search and Filter Bar */}
      <div className="mt-6">
        <SkillSearchFilter
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          filterMode={filterMode}
          onFilterModeChange={setFilterMode}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          totalResults={filteredMatches.length}
          onResetFilters={handleResetFilters}
        />
      </div>

      {profilesQuery.isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Hamkorlar yuklanmoqda…</p>
      ) : filteredMatches.length === 0 ? (
        <div className="surface-card mt-6 p-8 text-center space-y-3">
          <p className="text-base font-semibold">Mos hamkorlar topilmadi</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {hasActiveFilters
              ? "Tanlangan qidiruv so‘rovi yoki filtrlar bo‘yicha hech qanday a’zo topilmadi. Qidiruv so‘zini o‘zgartiring yoki filtrlarni tozalang."
              : "Hozircha tizimda boshqa faol foydalanuvchilar yo‘q yoki profilingizga hali ko‘nikmalar qo‘shilmagan."}
          </p>
          {hasActiveFilters ? (
            <Button variant="outline" size="sm" onClick={handleResetFilters} className="gap-2 mt-2">
              <RotateCcw className="size-3.5" />
              Filtrlarni tozalash
            </Button>
          ) : (
            <Button asChild size="sm" className="mt-2">
              <Link to="/profile">Profilingizni to‘ldirish</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredMatches.map((m) => (
            <MatchCard
              key={m.profile.id}
              profile={m.profile}
              match={m.match}
              meId={userId}
              alreadyRequested={requestedIds.has(m.profile.id)}
              pointsLeft={pointsQuery.data?.remaining ?? null}
              onRequested={() => {
                void sessionsQuery.refetch();
                void pointsQuery.refetch();
              }}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
