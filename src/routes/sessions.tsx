import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useRequireAuth } from "@/lib/auth";
import {
  fetchMySessions,
  fetchProfiles,
  formatDate,
  fullName,
  type ProfileWithSkills,
  type SwapSession,
} from "@/lib/peerswap";

export const Route = createFileRoute("/sessions")({
  head: () => ({
    meta: [
      { title: "My Sessions — PeerSwap" },
      { name: "description", content: "Track your pending, upcoming and completed skill swap sessions." },
      { property: "og:title", content: "My Sessions — PeerSwap" },
      { property: "og:description", content: "Track your pending, upcoming and completed skill swaps." },
    ],
  }),
  component: SessionsPage,
});

function SessionsPage() {
  const { user } = useRequireAuth();
  const { loading } = useAuth();

  const profilesQuery = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles, enabled: !!user });
  const sessionsQuery = useQuery({
    queryKey: ["sessions", user?.id],
    queryFn: () => fetchMySessions(user!.id),
    enabled: !!user,
  });
  const feedbackQuery = useQuery({
    queryKey: ["feedback", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("feedback").select("session_id").eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((row) => row.session_id as string);
    },
    enabled: !!user,
  });

  if (loading || !user) return null;

  const sessions = sessionsQuery.data ?? [];
  const profiles = profilesQuery.data ?? [];
  const byStatus = (status: SwapSession["status"]) => sessions.filter((s) => s.status === status);

  const refresh = () => {
    sessionsQuery.refetch();
    feedbackQuery.refetch();
    profilesQuery.refetch();
  };

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">My Sessions</h1>
      <p className="mt-1 text-sm text-muted-foreground">Every swap you requested or received.</p>

      <Tabs defaultValue="pending" className="mt-6">
        <TabsList>
          <TabsTrigger value="pending">Pending ({byStatus("pending").length})</TabsTrigger>
          <TabsTrigger value="accepted">Upcoming ({byStatus("accepted").length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({byStatus("completed").length})</TabsTrigger>
        </TabsList>

        {(["pending", "accepted", "completed"] as const).map((status) => (
          <TabsContent key={status} value={status} className="mt-4 space-y-4">
            {byStatus(status).length === 0 ? (
              <div className="surface-card p-6 text-sm text-muted-foreground">
                Nothing here yet.{" "}
                <Link to="/matches" className="text-primary hover:underline">
                  Find a match
                </Link>{" "}
                to start a swap.
              </div>
            ) : (
              byStatus(status).map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  meId={user.id}
                  profiles={profiles}
                  hasFeedback={(feedbackQuery.data ?? []).includes(session.id)}
                  onChanged={refresh}
                />
              ))
            )}
          </TabsContent>
        ))}
      </Tabs>
    </AppShell>
  );
}

function SessionCard({
  session,
  meId,
  profiles,
  hasFeedback,
  onChanged,
}: {
  session: SwapSession;
  meId: string;
  profiles: ProfileWithSkills[];
  hasFeedback: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const isRequester = session.requester_id === meId;
  const partnerId = isRequester ? session.partner_id : session.requester_id;
  const partner = profiles.find((p) => p.id === partnerId);
  const mySkill = isRequester ? session.requester_teaches : session.partner_teaches;
  const theirSkill = isRequester ? session.partner_teaches : session.requester_teaches;

  async function accept() {
    setBusy(true);
    const { error } = await supabase
      .from("swap_sessions")
      .update({ status: "accepted" })
      .eq("id", session.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Swap accepted!");
    onChanged();
  }

  async function complete() {
    setBusy(true);
    const { error } = await supabase.rpc("complete_session", { _session_id: session.id });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Session completed — you earned +10 PeerCoin!");
    onChanged();
  }

  return (
    <article className="surface-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">
            {mySkill} <span className="text-accent">↔</span> {theirSkill}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Partner: {partner ? fullName(partner) : "PeerSwap member"} · {formatDate(session.created_at)}
          </p>
        </div>
        <span className="rounded-full border border-border bg-secondary px-3 py-1 text-xs capitalize text-muted-foreground">
          {session.status}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {session.status === "pending" ? (
          <Button size="sm" onClick={accept} disabled={busy}>
            {isRequester ? "Accept on behalf (demo)" : "Accept request"}
          </Button>
        ) : null}
        {session.status === "accepted" ? (
          <Button size="sm" onClick={complete} disabled={busy}>
            Mark as Completed
          </Button>
        ) : null}
      </div>

      {session.status === "completed" ? (
        hasFeedback ? (
          <p className="mt-4 text-sm text-accent">Thanks for your feedback!</p>
        ) : (
          <FeedbackForm sessionId={session.id} meId={meId} onDone={onChanged} />
        )
      ) : null}
    </article>
  );
}

function FeedbackForm({
  sessionId,
  meId,
  onDone,
}: {
  sessionId: string;
  meId: string;
  onDone: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const { error } = await supabase
      .from("feedback")
      .insert({ session_id: sessionId, user_id: meId, rating, comment });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Thanks for your feedback!");
    onDone();
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="text-sm font-medium">How was your session?</p>
      <div className="mt-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            aria-label={`${value} star`}
            onClick={() => setRating(value)}
            className="transition-transform hover:scale-110"
          >
            <Star
              className={
                "size-6 " + (value <= rating ? "fill-accent text-accent" : "text-muted-foreground")
              }
            />
          </button>
        ))}
      </div>
      <Textarea
        className="mt-3"
        placeholder="Optional feedback"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <Button size="sm" className="mt-3" onClick={submit} disabled={busy}>
        Submit Feedback
      </Button>
    </div>
  );
}
