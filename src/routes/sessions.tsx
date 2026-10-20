import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import {
  Star,
  MessageSquare,
  Video,
  Film,
  Play,
  Download,
  Edit2,
  Plus,
  ShieldCheck,
  CheckCircle2,
  Flag,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportUserModal } from "@/components/ReportUserModal";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db } from "@/lib/firebase";
import { collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { useAuth, useRequireAuth } from "@/lib/auth";
import {
  fetchMySessions,
  fetchProfiles,
  formatDate,
  fullName,
  type ProfileWithSkills,
  type SwapSession,
} from "@/lib/peerswap";
import { SessionChatModal } from "@/components/SessionChatModal";
import { VideoSessionModal } from "@/components/VideoSessionModal";
import { SessionReviewModal } from "@/components/SessionReviewModal";
import { fetchSessionRecordings, type SessionRecording } from "@/lib/session-room";

export const Route = createFileRoute("/sessions")({
  head: () => ({
    meta: [
      { title: "Mashg‘ulotlarim — PeerSwap" },
      {
        name: "description",
        content: "Kutilayotgan, rejalashtirilgan va yakunlangan almashinuvlarni kuzating.",
      },
      { property: "og:title", content: "Mashg‘ulotlarim — PeerSwap" },
      {
        property: "og:description",
        content: "Kutilayotgan, rejalashtirilgan va yakunlangan almashinuvlarni kuzating.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SessionsPage,
});

function SessionsPage() {
  const { user } = useRequireAuth();
  const { loading } = useAuth();

  const [chatSession, setChatSession] = useState<SwapSession | null>(null);
  const [videoSession, setVideoSession] = useState<SwapSession | null>(null);
  const [reviewSession, setReviewSession] = useState<SwapSession | null>(null);
  const [editingSession, setEditingSession] = useState<SwapSession | null>(null);
  const [reportingSession, setReportingSession] = useState<SwapSession | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const userId = user?.uid ?? "";

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
  const feedbackQuery = useQuery({
    queryKey: ["feedback", userId],
    queryFn: async () => {
      const q = query(collection(db, "feedback"), where("user_id", "==", userId));
      const snap = await getDocs(q);
      const sessionIds: string[] = [];
      snap.forEach((d) => {
        const sid = d.data().session_id;
        if (sid) sessionIds.push(sid);
      });
      return sessionIds;
    },
    enabled: !!user,
  });

  const profiles = useMemo(() => profilesQuery.data ?? [], [profilesQuery.data]);
  const myProfile = useMemo(() => profiles.find((p) => p.id === userId), [profiles, userId]);
  const myName = myProfile ? fullName(myProfile) : "Siz";

  if (loading || !user) return null;

  const sessions = sessionsQuery.data ?? [];
  const byStatus = (status: SwapSession["status"]) => sessions.filter((s) => s.status === status);
  const disputedCount = sessions.filter(
    (s) => s.status === "disputed" || s.status === "needs_review",
  ).length;

  const refresh = () => {
    sessionsQuery.refetch();
    feedbackQuery.refetch();
    profilesQuery.refetch();
  };

  const partnerOf = (s: SwapSession) => {
    const pId = s.requester_id === userId ? s.partner_id : s.requester_id;
    return profiles.find((p) => p.id === pId);
  };

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Mashg‘ulotlarim</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Siz yuborgan yoki qabul qilgan barcha ko‘nikma almashinuvlari.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/matches">
            <Button size="sm" className="gap-2">
              <Plus className="size-4" />
              Yangi almashinuv topish
            </Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="accepted" className="mt-6">
        <TabsList>
          <TabsTrigger value="accepted">
            Rejalashtirilgan ({byStatus("accepted").length})
          </TabsTrigger>
          <TabsTrigger value="pending">Kutilmoqda ({byStatus("pending").length})</TabsTrigger>
          <TabsTrigger value="completed">Yakunlangan ({byStatus("completed").length})</TabsTrigger>
          {disputedCount > 0 && (
            <TabsTrigger value="disputed" className="text-amber-400">
              Nizoli / Tekshiruvda ({disputedCount})
            </TabsTrigger>
          )}
        </TabsList>

        {(["accepted", "pending", "completed"] as const).map((status) => (
          <TabsContent key={status} value={status} className="mt-4 space-y-4">
            {byStatus(status).length === 0 ? (
              <div className="surface-card p-6 text-sm text-muted-foreground">
                Hozircha hech narsa yo‘q. Almashinuvni boshlash uchun{" "}
                <Link to="/matches" className="text-primary hover:underline">
                  hamkor toping
                </Link>{" "}
                yoki{" "}
                <Link to="/calendar" className="text-primary hover:underline">
                  kalendarda slot band qiling
                </Link>
                .
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
                  onOpenChat={() => setChatSession(session)}
                  onOpenVideo={() => setVideoSession(session)}
                  onOpenReview={() => setReviewSession(session)}
                  onEdit={() => setEditingSession(session)}
                  onReportUser={() => setReportingSession(session)}
                />
              ))
            )}
          </TabsContent>
        ))}

        {disputedCount > 0 && (
          <TabsContent value="disputed" className="mt-4 space-y-4">
            {sessions
              .filter((s) => s.status === "disputed" || s.status === "needs_review")
              .map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  meId={user.id}
                  profiles={profiles}
                  hasFeedback={(feedbackQuery.data ?? []).includes(session.id)}
                  onChanged={refresh}
                  onOpenChat={() => setChatSession(session)}
                  onOpenVideo={() => setVideoSession(session)}
                  onOpenReview={() => setReviewSession(session)}
                  onEdit={() => setEditingSession(session)}
                  onReportUser={() => setReportingSession(session)}
                />
              ))}
          </TabsContent>
        )}
      </Tabs>

      {/* CHAT MODAL */}
      {chatSession && (
        <SessionChatModal
          isOpen={!!chatSession}
          onClose={() => setChatSession(null)}
          sessionId={chatSession.id}
          userId={user.id}
          userName={myName}
          partnerId={
            chatSession.requester_id === user.id ? chatSession.partner_id : chatSession.requester_id
          }
          partnerName={
            partnerOf(chatSession) ? fullName(partnerOf(chatSession)!) : "PeerSwap a’zosi"
          }
          skillName={
            chatSession.requester_id === user.id
              ? chatSession.partner_teaches
              : chatSession.requester_teaches
          }
          onOpenVideoCall={() => {
            const s = chatSession;
            setChatSession(null);
            setVideoSession(s);
          }}
          onReschedule={() => {
            const s = chatSession;
            setChatSession(null);
            setEditingSession(s);
          }}
        />
      )}

      {/* VIDEO MODAL */}
      {videoSession && (
        <VideoSessionModal
          isOpen={!!videoSession}
          onClose={() => setVideoSession(null)}
          sessionId={videoSession.id}
          userId={userId}
          userName={myName}
          isOwner={videoSession.requester_id === userId}
          partnerId={
            videoSession.requester_id === userId
              ? videoSession.partner_id
              : videoSession.requester_id
          }
          partnerName={
            partnerOf(videoSession) ? fullName(partnerOf(videoSession)!) : "PeerSwap a’zosi"
          }
          skillName={
            videoSession.requester_id === userId
              ? videoSession.partner_teaches
              : videoSession.requester_teaches
          }
          onSessionEnded={() => {
            const s = videoSession;
            setVideoSession(null);
            setReviewSession(s);
          }}
        />
      )}

      {/* REVIEW & SAFE COMPLETION MODAL */}
      {reviewSession && (
        <SessionReviewModal
          isOpen={!!reviewSession}
          onClose={() => setReviewSession(null)}
          sessionId={reviewSession.id}
          isCalendarSlot={false}
          userId={userId}
          partnerId={
            reviewSession.requester_id === userId
              ? reviewSession.partner_id
              : reviewSession.requester_id
          }
          isOwner={reviewSession.requester_id === userId}
          partnerName={
            partnerOf(reviewSession) ? fullName(partnerOf(reviewSession)!) : "PeerSwap a’zosi"
          }
          skillName={
            reviewSession.requester_id === userId
              ? reviewSession.partner_teaches
              : reviewSession.requester_teaches
          }
          onCompleted={() => {
            setReviewSession(null);
            refresh();
          }}
        />
      )}

      {/* REPORT USER MODAL */}
      {reportingSession && (
        <ReportUserModal
          isOpen={!!reportingSession}
          onClose={() => setReportingSession(null)}
          reportedUserId={
            reportingSession.requester_id === userId
              ? reportingSession.partner_id
              : reportingSession.requester_id
          }
          reportedUserName={
            partnerOf(reportingSession) ? fullName(partnerOf(reportingSession)!) : "PeerSwap a’zosi"
          }
          reporterUserId={userId}
          sessionId={reportingSession.id}
        />
      )}

      {/* EDIT SESSION DETAILS MODAL */}
      {editingSession && (
        <EditSessionModal
          session={editingSession}
          isOpen={!!editingSession}
          onClose={() => setEditingSession(null)}
          onSaved={() => {
            setEditingSession(null);
            refresh();
          }}
        />
      )}
    </AppShell>
  );
}

function SessionCard({
  session,
  meId,
  profiles,
  hasFeedback,
  onChanged,
  onOpenChat,
  onOpenVideo,
  onOpenReview,
  onEdit,
  onReportUser,
}: {
  session: SwapSession;
  meId: string;
  profiles: ProfileWithSkills[];
  hasFeedback: boolean;
  onChanged: () => void;
  onOpenChat: () => void;
  onOpenVideo: () => void;
  onOpenReview: () => void;
  onEdit: () => void;
  onReportUser: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [recordings, setRecordings] = useState<SessionRecording[]>([]);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);

  const isRequester = session.requester_id === meId;
  const partnerId = isRequester ? session.partner_id : session.requester_id;
  const partner = profiles.find((p) => p.id === partnerId);
  const mySkill = isRequester ? session.requester_teaches : session.partner_teaches;
  const theirSkill = isRequester ? session.partner_teaches : session.requester_teaches;

  useEffect(() => {
    fetchSessionRecordings(session.id).then(setRecordings);
  }, [session.id]);

  async function accept() {
    setBusy(true);
    try {
      await updateDoc(doc(db, "swap_sessions", session.id), { status: "accepted" });
      toast.success("Almashinuv qabul qilindi! Chat va video dars ochildi.");
      onChanged();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function cancelSession() {
    setBusy(true);
    try {
      await updateDoc(doc(db, "swap_sessions", session.id), { status: "pending" });
      toast.info("Mashg‘ulot bekor qilindi. Coinlar saqlandi.");
      onChanged();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  const getStatusBadge = () => {
    switch (session.status) {
      case "pending":
        return (
          <span className="rounded-full border border-border bg-secondary px-3 py-1 text-xs text-muted-foreground">
            Kutilmoqda
          </span>
        );
      case "accepted":
        return (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400">
            Rejalashtirilgan (Jonli)
          </span>
        );
      case "completed":
        return (
          <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
            Yakunlangan
          </span>
        );
      case "disputed":
        return (
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-400">
            Nizoli (No-show)
          </span>
        );
      case "needs_review":
        return (
          <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs text-rose-400">
            Tekshiruvda (48s)
          </span>
        );
      default:
        return (
          <span className="rounded-full border border-border bg-secondary px-3 py-1 text-xs capitalize text-muted-foreground">
            {session.status}
          </span>
        );
    }
  };

  return (
    <article className="surface-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold flex items-center gap-2">
            <span>{mySkill}</span>
            <span className="text-accent">↔</span>
            <span>{theirSkill}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Hamkor: {partner ? fullName(partner) : "PeerSwap a’zosi"} ·{" "}
            {formatDate(session.created_at)}
          </p>
        </div>
        {getStatusBadge()}
      </div>

      {/* Disputed / Needs review warning alerts */}
      {session.status === "disputed" && (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 flex items-start gap-2">
          <AlertTriangle className="size-4 shrink-0 text-amber-400 mt-0.5" />
          <div>
            <p className="font-semibold">Mashg‘ulot nizoli (No-show qayd etilgan)</p>
            <p className="text-amber-200/80 mt-0.5">
              {session.no_show_reason ||
                "Ishtirokchilardan biri darsga kelmaganlik haqida xabar berdi. Balansdan PeerPoint yechilmadi."}
            </p>
          </div>
        </div>
      )}

      {session.status === "needs_review" && (
        <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-start gap-2">
          <ShieldAlert className="size-4 shrink-0 text-rose-400 mt-0.5" />
          <div>
            <p className="font-semibold">Administrator tekshiruvida</p>
            <p className="text-rose-200/80 mt-0.5">
              {session.review_reason ||
                "Bir tomonlama tasdiqlash 48 soatdan oshgani sababli tizim tomonidan ma’muriyat tekshiruviga yuborildi."}
            </p>
          </div>
        </div>
      )}

      {/* Saved lesson recordings */}
      {recordings.length > 0 && (
        <div className="mt-3 rounded-lg border border-border bg-secondary/30 p-2.5">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-1.5">
            <Film className="size-3.5 text-accent" /> Dars yozuvlari ({recordings.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {recordings.map((rec) => (
              <div
                key={rec.id}
                className="flex items-center gap-2 rounded bg-card px-2 py-1 text-xs border border-border"
              >
                <span className="truncate max-w-[160px] font-medium">{rec.title}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-5"
                  onClick={() => setPlaybackUrl(rec.videoUrl)}
                  title="Ko‘rish"
                >
                  <Play className="size-3" />
                </Button>
                <a
                  href={rec.videoUrl}
                  download={`${rec.title}.webm`}
                  className="hover:text-primary"
                  title="Yuklab olish"
                >
                  <Download className="size-3" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {session.status === "pending" ? (
          <>
            <Button size="sm" onClick={accept} disabled={busy}>
              {isRequester ? "Hamkor nomidan qabul qilish (demo)" : "So‘rovni qabul qilish"}
            </Button>
            <Button size="sm" variant="outline" onClick={onOpenChat} className="gap-1.5">
              <MessageSquare className="size-3.5 text-primary" /> Chat
            </Button>
          </>
        ) : null}

        {session.status === "accepted" ? (
          <>
            <Button size="sm" variant="outline" onClick={onOpenChat} className="gap-1.5">
              <MessageSquare className="size-3.5 text-primary" /> Suhbat (Chat)
            </Button>
            <Button
              size="sm"
              onClick={onOpenVideo}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Video className="size-3.5" /> Video darsga kirish
            </Button>
            <Button size="sm" variant="outline" onClick={onEdit} className="gap-1.5 text-xs">
              <Edit2 className="size-3.5" /> O‘zgartirish
            </Button>
            <Button
              size="sm"
              onClick={onOpenReview}
              className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Star className="size-3.5" /> Yakunlash va Baholash
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onOpenReview}
              disabled={busy}
              className="text-amber-400 border-amber-500/30 hover:bg-amber-500/10 text-xs"
              title="Hamkor darsga qatnashmagan bo‘lsa no-show qayd qilish"
            >
              <AlertTriangle className="size-3.5 mr-1" />
              Hamkor kelmadi (No-show)
            </Button>
          </>
        ) : null}

        {/* Global Report User action button */}
        <Button
          size="sm"
          variant="ghost"
          onClick={onReportUser}
          className="text-xs text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 gap-1.5 ml-auto"
          title="Foydalanuvchi yoki mashg‘ulot yuzasidan shikoyat qilish"
        >
          <Flag className="size-3.5 text-rose-400" /> Shikoyat qilish
        </Button>
      </div>

      {session.status === "completed" ? (
        hasFeedback ? (
          <p className="mt-4 text-xs text-accent flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5" /> Fikr-mulohazangiz qabul qilingan va Coinlar
            adolatli o‘tkazilgan.
          </p>
        ) : (
          <div className="mt-3">
            <Button size="sm" variant="outline" onClick={onOpenReview} className="gap-1.5 text-xs">
              <Star className="size-3.5 text-accent" /> Baho berish
            </Button>
          </div>
        )
      ) : null}

      {/* Playback dialog */}
      {playbackUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="relative w-full max-w-xl rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between pb-3">
              <h3 className="text-sm font-semibold">Dars videoyozuvi</h3>
              <Button variant="ghost" size="sm" onClick={() => setPlaybackUrl(null)}>
                ✕ Yopish
              </Button>
            </div>
            <video
              src={playbackUrl}
              controls
              autoPlay
              className="aspect-video w-full rounded-lg bg-black"
            />
          </div>
        </div>
      )}
    </article>
  );
}

function EditSessionModal({
  session,
  isOpen,
  onClose,
  onSaved,
}: {
  session: SwapSession;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reqTeaches, setReqTeaches] = useState(session.requester_teaches);
  const [partTeaches, setPartTeaches] = useState(session.partner_teaches);
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    try {
      await updateDoc(doc(db, "swap_sessions", session.id), {
        requester_teaches: reqTeaches.trim(),
        partner_teaches: partTeaches.trim(),
      });
      toast.success("Sessiya ma’lumotlari yangilandi!");
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sessiyani tahrirlash (O‘zgartirish)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Birinchi tomon o‘rgatadi:</Label>
            <Input
              value={reqTeaches}
              onChange={(e) => setReqTeaches(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Ikkinchi tomon o‘rgatadi:</Label>
            <Input
              value={partTeaches}
              onChange={(e) => setPartTeaches(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Bekor qilish
          </Button>
          <Button onClick={handleSave} disabled={busy}>
            {busy ? "Saqlanmoqda…" : "O‘zgartirishni saqlash"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
