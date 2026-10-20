import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { collection, doc, getDocs, updateDoc } from "firebase/firestore";
import { ShieldAlert, AlertTriangle, CheckCircle2, Flag } from "lucide-react";

import { AppShell } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/lib/firebase";
import { useRequireAdmin } from "@/lib/auth";
import { fetchProfiles, formatDate, fullName, type SwapSession } from "@/lib/peerswap";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — PeerSwap" },
      {
        name: "description",
        content: "PeerSwap foydalanuvchilari, mashg‘ulotlari va fikr-mulohazalarini boshqarish.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Admin — PeerSwap" },
      { property: "og:description", content: "PeerSwap boshqaruv sahifasi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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

type ReportRow = {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  session_id: string | null;
  reason: string;
  details: string;
  status: "pending" | "resolved" | "dismissed";
  created_at: string;
};

type AiRecommendationRow = {
  id: string;
  user_id: string;
  need: string;
  quality: string;
  note: string;
  recommendations: Array<{ id: string; score: number; reason: string }>;
  created_at: string;
};

const QUALITY_LABEL: Record<string, string> = {
  fast: "Tez",
  balanced: "Muvozanatli",
  deep: "Chuqur",
};

function AdminPage() {
  const { user, loading, isAdmin } = useRequireAdmin();

  const profilesQuery = useQuery({
    queryKey: ["profiles"],
    queryFn: fetchProfiles,
    enabled: !!user && isAdmin,
  });

  const sessionsQuery = useQuery({
    queryKey: ["admin-sessions"],
    queryFn: async () => {
      const snap = await getDocs(collection(db, "swap_sessions"));
      const list: SwapSession[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          requester_id: data.requester_id || "",
          partner_id: data.partner_id || "",
          requester_teaches: data.requester_teaches || "",
          partner_teaches: data.partner_teaches || "",
          status: data.status || "pending",
          created_at: data.created_at || new Date().toISOString(),
          completed_at: data.completed_at || null,
          requester_confirmed: data.requester_confirmed,
          requester_confirmed_at: data.requester_confirmed_at,
          partner_confirmed: data.partner_confirmed,
          partner_confirmed_at: data.partner_confirmed_at,
          no_show: data.no_show,
          no_show_reported_by: data.no_show_reported_by,
          no_show_reason: data.no_show_reason,
          review_reason: data.review_reason,
          flagged_for_admin: data.flagged_for_admin,
        });
      });
      return list.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    },
    enabled: !!user && isAdmin,
  });

  const reportsQuery = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const snap = await getDocs(collection(db, "reports"));
      const list: ReportRow[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          reporter_id: data.reporter_id || "",
          reported_user_id: data.reported_user_id || "",
          session_id: data.session_id || null,
          reason: data.reason || "",
          details: data.details || "",
          status: data.status || "pending",
          created_at: data.created_at || new Date().toISOString(),
        });
      });
      return list.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    },
    enabled: !!user && isAdmin,
  });

  const aiQuery = useQuery({
    queryKey: ["admin-ai-recommendations"],
    queryFn: async () => {
      const snap = await getDocs(collection(db, "ai_recommendations"));
      const list: AiRecommendationRow[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          user_id: data.user_id || "",
          need: data.need || "",
          quality: data.quality || "balanced",
          note: data.note || "",
          recommendations: data.recommendations || [],
          created_at: data.created_at || new Date().toISOString(),
        });
      });
      return list.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    },
    enabled: !!user && isAdmin,
  });

  const feedbackQuery = useQuery({
    queryKey: ["admin-feedback"],
    queryFn: async () => {
      const snap = await getDocs(collection(db, "feedback"));
      const list: FeedbackRow[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          session_id: data.session_id || "",
          user_id: data.user_id || "",
          rating: data.rating || 5,
          comment: data.comment || "",
          created_at: data.created_at || new Date().toISOString(),
        });
      });
      return list.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    },
    enabled: !!user && isAdmin,
  });

  if (loading || !user) return null;

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="surface-card p-8 text-center max-w-lg mx-auto mt-12 rounded-2xl border border-border">
          <h2 className="text-xl font-bold">Admin ruxsati talab qilinadi</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Siz admin sifatida ro‘yxatdan o‘tmagansiz. Iltimos,{" "}
            <Link to="/dashboard" className="text-primary font-medium hover:underline">
              bosh sahifangizga
            </Link>{" "}
            qayting.
          </p>
        </div>
      </AppShell>
    );
  }

  const profiles = profilesQuery.data ?? [];
  const sessions = sessionsQuery.data ?? [];
  const reports = reportsQuery.data ?? [];
  const feedback = feedbackQuery.data ?? [];
  const aiRecs = aiQuery.data ?? [];
  const totalSkills = new Set(profiles.flatMap((p) => [...p.teach, ...p.learn])).size;

  const flaggedSessions = sessions.filter(
    (s) =>
      s.status === "needs_review" || s.status === "disputed" || s.no_show || s.flagged_for_admin,
  );

  const nameOf = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    return p ? fullName(p) : "Noma’lum";
  };

  async function deactivate(id: string, active: boolean) {
    try {
      await updateDoc(doc(db, "profiles", id), { is_active: !active });
      toast.success(
        active ? "Foydalanuvchi faolsizlantirildi" : "Foydalanuvchi qayta faollashtirildi",
      );
      profilesQuery.refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    }
  }

  async function updateReportStatus(reportId: string, status: "resolved" | "dismissed") {
    try {
      await updateDoc(doc(db, "reports", reportId), {
        status,
        updated_at: new Date().toISOString(),
      });
      toast.success(status === "resolved" ? "Shikoyat hal etildi" : "Shikoyat bekor qilindi");
      reportsQuery.refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    }
  }

  async function resolveSession(sessionId: string, newStatus: "completed" | "pending") {
    try {
      await updateDoc(doc(db, "swap_sessions", sessionId), {
        status: newStatus,
        review_reason: "Administrator tomonidan ko‘rib chiqildi va yakuniy qaror qabul qilindi",
        flagged_for_admin: false,
        updated_at: new Date().toISOString(),
      });
      toast.success(`Mashg‘ulot holati "${newStatus}" ga o‘zgartirildi.`);
      sessionsQuery.refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    }
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Boshqaruv paneli</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Jami foydalanuvchilar" value={profiles.length} />
        <Stat label="Jami mashg‘ulotlar" value={sessions.length} />
        <Stat
          label="Yakunlangan mashg‘ulotlar"
          value={sessions.filter((s) => s.status === "completed").length}
        />
        <Stat label="Shikoyat va Nizolar" value={reports.length + flaggedSessions.length} />
        <Stat label="Jami ko‘nikmalar" value={totalSkills} />
      </div>

      <Tabs defaultValue="users" className="mt-8">
        <TabsList>
          <TabsTrigger value="users">Foydalanuvchilar ({profiles.length})</TabsTrigger>
          <TabsTrigger value="sessions">Mashg‘ulotlar ({sessions.length})</TabsTrigger>
          <TabsTrigger
            value="reports"
            className={
              reports.length + flaggedSessions.length > 0 ? "text-amber-400 font-semibold" : ""
            }
          >
            Shikoyat va Nizolar ({reports.length + flaggedSessions.length})
          </TabsTrigger>
          <TabsTrigger value="feedback">Fikrlar ({feedback.length})</TabsTrigger>
          <TabsTrigger value="ai">AI Tavsiyalari ({aiRecs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4 space-y-3">
          {profiles.map((p) => (
            <div key={p.id} className="surface-card flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium">
                  {fullName(p)} {!p.is_active ? "· (Faolsizlantirilgan)" : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {p.peercoins} PeerPoint · o‘rgatadi: {p.teach.length} · o‘rganadi:{" "}
                  {p.learn.length}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => deactivate(p.id, p.is_active)}>
                {p.is_active ? "Faolsizlantirish" : "Faollashtirish"}
              </Button>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="sessions" className="mt-4 space-y-3">
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Hozircha mashg‘ulotlar yo‘q.</p>
          ) : (
            sessions.map((s) => (
              <div key={s.id} className="surface-card p-4">
                <p className="font-medium">
                  {s.requester_teaches} <span className="text-accent">↔</span> {s.partner_teaches}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {nameOf(s.requester_id)} · {nameOf(s.partner_id)} · {s.status} ·{" "}
                  {formatDate(s.created_at)}
                </p>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="reports" className="mt-4 space-y-6">
          {/* Flagged and Disputed Sessions Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <ShieldAlert className="size-4 text-amber-400" />
              Nizoli va 48s avtomatik bayroqlangan mashg‘ulotlar ({flaggedSessions.length})
            </h3>
            {flaggedSessions.length === 0 ? (
              <p className="text-xs text-muted-foreground surface-card p-4">
                Hozirda hech qanday nizoli yoki ko‘rib chiqish talab etiladigan darslar yo‘q.
              </p>
            ) : (
              flaggedSessions.map((s) => (
                <div key={s.id} className="surface-card p-4 border border-amber-500/30">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm">
                        {s.requester_teaches} ↔ {s.partner_teaches}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Ishtirokchilar: {nameOf(s.requester_id)} va {nameOf(s.partner_id)}
                      </p>
                    </div>
                    <span className="rounded bg-amber-500/20 text-amber-300 text-xs px-2.5 py-0.5 font-medium">
                      {s.status === "needs_review" ? "48s Kutish (Needs Review)" : "No-Show Nizo"}
                    </span>
                  </div>
                  <div className="mt-3 rounded bg-secondary/60 p-2.5 text-xs">
                    <p className="font-medium text-amber-300">Sabab:</p>
                    <p className="mt-0.5 text-muted-foreground">
                      {s.review_reason || s.no_show_reason || "Avtomatik tekshiruvga yuborilgan"}
                    </p>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      className="text-xs"
                      onClick={() => resolveSession(s.id, "completed")}
                    >
                      Tasdiqlash & Yakunlash
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => resolveSession(s.id, "pending")}
                    >
                      Bekor qilish (Qaytarish)
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* User Submitted Reports Section */}
          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Flag className="size-4 text-rose-400" />
              Foydalanuvchilar shikoyatlari ({reports.length})
            </h3>
            {reports.length === 0 ? (
              <p className="text-xs text-muted-foreground surface-card p-4">
                Hozircha hech qanday foydalanuvchi shikoyati kelib tushmagan.
              </p>
            ) : (
              reports.map((r) => (
                <div key={r.id} className="surface-card p-4 border border-border">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">
                        Shikoyatchi: <span className="text-accent">{nameOf(r.reporter_id)}</span> →
                        Shikoyat qilingan:{" "}
                        <span className="text-rose-400 font-semibold">
                          {nameOf(r.reported_user_id)}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Sabab turi:{" "}
                        <span className="uppercase font-mono text-[10px]">{r.reason}</span> ·{" "}
                        {formatDate(r.created_at)}
                      </p>
                    </div>
                    <span
                      className={`rounded text-xs px-2.5 py-0.5 font-medium ${
                        r.status === "resolved"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : r.status === "dismissed"
                            ? "bg-secondary text-muted-foreground"
                            : "bg-rose-500/20 text-rose-300"
                      }`}
                    >
                      {r.status === "resolved"
                        ? "Hal etilgan"
                        : r.status === "dismissed"
                          ? "Bekor qilingan"
                          : "Kutilmoqda"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-secondary-foreground bg-secondary/30 p-2.5 rounded border border-border">
                    {r.details || "Tafsilot yozilmagan"}
                  </p>
                  {r.status === "pending" && (
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => updateReportStatus(r.id, "resolved")}
                      >
                        Hal etildi deb belgilash
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => updateReportStatus(r.id, "dismissed")}
                      >
                        Asossiz deb bekor qilish
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="feedback" className="mt-4 space-y-3">
          {feedback.length === 0 ? (
            <p className="text-sm text-muted-foreground">Hozircha fikr-mulohazalar yo‘q.</p>
          ) : (
            feedback.map((f) => (
              <div key={f.id} className="surface-card p-4">
                <p className="font-medium">
                  {"★".repeat(f.rating)}
                  <span className="text-muted-foreground">{"★".repeat(5 - f.rating)}</span>
                </p>
                <p className="mt-1 text-sm">{f.comment || "Izoh yo‘q"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {nameOf(f.user_id)} · {formatDate(f.created_at)}
                </p>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="ai" className="mt-4 space-y-3">
          {aiQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Yuklanmoqda…</p>
          ) : aiRecs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Hozircha AI tavsiyalari yo‘q.</p>
          ) : (
            aiRecs.map((r) => (
              <div key={r.id} className="surface-card p-4">
                <p className="text-xs text-muted-foreground">
                  {nameOf(r.user_id)} · {QUALITY_LABEL[r.quality] ?? r.quality} ·{" "}
                  {formatDate(r.created_at)}
                </p>
                <p className="mt-1 text-sm font-medium">“{r.need}”</p>
                {r.note ? <p className="mt-1 text-sm text-muted-foreground">{r.note}</p> : null}
                <ul className="mt-2 space-y-1 text-sm">
                  {(r.recommendations ?? []).map((rec, i) => (
                    <li key={`${r.id}-${rec.id}-${i}`}>
                      <span className="font-medium">{nameOf(rec.id)}</span>{" "}
                      <span className="text-accent">{rec.score}%</span>{" "}
                      <span className="text-muted-foreground">— {rec.reason}</span>
                    </li>
                  ))}
                </ul>
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
