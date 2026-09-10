import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { AppShell } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useRequireAuth } from "@/lib/auth";
import { fetchProfiles, formatDate, fullName, type SwapSession } from "@/lib/peerswap";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — PeerSwap" },
      { name: "description", content: "PeerSwap admin overview of users, sessions and feedback." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Admin — PeerSwap" },
      { property: "og:description", content: "PeerSwap admin overview." },
    ],
  }),
  component: AdminPage,
});

type FeedbackRow = {
  id: string;
  session_id: string;
  user_id: string;
  rating: number;
  comment: string;
  created_at: string;
};

function AdminPage() {
  const { user } = useRequireAuth();
  const { loading } = useAuth();

  const roleQuery = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!user,
  });

  const profilesQuery = useQuery({
    queryKey: ["profiles"],
    queryFn: fetchProfiles,
    enabled: !!user && roleQuery.data === true,
  });
  const sessionsQuery = useQuery({
    queryKey: ["admin-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("swap_sessions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SwapSession[];
    },
    enabled: !!user && roleQuery.data === true,
  });
  const feedbackQuery = useQuery({
    queryKey: ["admin-feedback"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feedback")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FeedbackRow[];
    },
    enabled: !!user && roleQuery.data === true,
  });

  if (loading || !user) return null;

  if (roleQuery.isLoading) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Checking access…</p>
      </AppShell>
    );
  }

  if (!roleQuery.data) {
    return (
      <AppShell>
        <div className="surface-card p-8 text-center">
          <h1 className="text-xl font-semibold">Admins only</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This area is restricted. Head back to your{" "}
            <Link to="/dashboard" className="text-primary hover:underline">
              dashboard
            </Link>
            .
          </p>
        </div>
      </AppShell>
    );
  }

  const profiles = profilesQuery.data ?? [];
  const sessions = sessionsQuery.data ?? [];
  const feedback = feedbackQuery.data ?? [];
  const totalSkills = new Set(profiles.flatMap((p) => [...p.teach, ...p.learn])).size;
  const nameOf = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    return p ? fullName(p) : "Unknown";
  };

  async function deactivate(id: string, active: boolean) {
    const { error } = await supabase.from("profiles").update({ is_active: !active }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(active ? "User deactivated" : "User reactivated");
    profilesQuery.refetch();
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Admin Dashboard</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total Users" value={profiles.length} />
        <Stat label="Total Sessions" value={sessions.length} />
        <Stat label="Completed Sessions" value={sessions.filter((s) => s.status === "completed").length} />
        <Stat label="Total Skills" value={totalSkills} />
      </div>

      <Tabs defaultValue="users" className="mt-8">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4 space-y-3">
          {profiles.map((p) => (
            <div key={p.id} className="surface-card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">
                  {fullName(p)}{" "}
                  {!p.is_active ? <span className="text-xs text-destructive">(deactivated)</span> : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {p.peercoins} PeerCoin · teaches {p.teach.length} · wants {p.learn.length}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => deactivate(p.id, p.is_active)}>
                {p.is_active ? "Deactivate" : "Reactivate"}
              </Button>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="sessions" className="mt-4 space-y-3">
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sessions yet.</p>
          ) : (
            sessions.map((s) => (
              <div key={s.id} className="surface-card p-4">
                <p className="font-medium">
                  {s.requester_teaches} <span className="text-accent">↔</span> {s.partner_teaches}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {nameOf(s.requester_id)} · {nameOf(s.partner_id)} · {s.status} · {formatDate(s.created_at)}
                </p>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="feedback" className="mt-4 space-y-3">
          {feedback.length === 0 ? (
            <p className="text-sm text-muted-foreground">No feedback yet.</p>
          ) : (
            feedback.map((f) => (
              <div key={f.id} className="surface-card p-4">
                <p className="font-medium">
                  {"★".repeat(f.rating)}
                  <span className="text-muted-foreground">{"★".repeat(5 - f.rating)}</span>
                </p>
                <p className="mt-1 text-sm">{f.comment || "No comment"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {nameOf(f.user_id)} · {formatDate(f.created_at)}
                </p>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-card p-5">
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
