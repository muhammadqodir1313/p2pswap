import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Repeat2,
  Inbox,
  Send,
  GraduationCap,
  Lightbulb,
  Plus,
  X,
  MessageSquare,
  Video,
  Star,
  Check,
  Calendar,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  fullName,
  initials,
  formatDate,
  type ProfileWithSkills,
  type SwapSession,
  type SkillKind,
} from "@/lib/peerswap";
import { SessionChatModal } from "@/components/SessionChatModal";
import { VideoSessionModal } from "@/components/VideoSessionModal";
import { SessionReviewModal } from "@/components/SessionReviewModal";
import { RealtimeSessionChat } from "@/components/RealtimeSessionChat";

type UserDashboardSwapsAndSkillsProps = {
  user: { id: string; email?: string };
  myProfile?: ProfileWithSkills;
  allProfiles: ProfileWithSkills[];
  sessions: SwapSession[];
  onRefresh: () => void;
};

const POPULAR_TEACH_SUGGESTIONS = [
  "React",
  "Python",
  "TypeScript",
  "Figma",
  "Ingliz tili",
  "SQL",
  "Docker",
  "Node.js",
  "UI/UX Dizayn",
];

const POPULAR_LEARN_SUGGESTIONS = [
  "Go (Golang)",
  "Prompt Engineering",
  "Data Science",
  "Nemis tili",
  "PostgreSQL",
  "Flutter",
  "Marketing",
  "Sun’iy intellekt",
];

export function UserDashboardSwapsAndSkills({
  user,
  myProfile,
  allProfiles,
  sessions,
  onRefresh,
}: UserDashboardSwapsAndSkillsProps) {
  // Modal states
  const [chatSession, setChatSession] = useState<SwapSession | null>(null);
  const [videoSession, setVideoSession] = useState<SwapSession | null>(null);
  const [reviewSession, setReviewSession] = useState<SwapSession | null>(null);

  // Tab & embedded chat state
  const [activeTab, setActiveTab] = useState<string>("active");
  const [selectedChatSessionId, setSelectedChatSessionId] = useState<string | null>(null);

  // Skill management inputs
  const [teachInput, setTeachInput] = useState("");
  const [learnInput, setLearnInput] = useState("");
  const [savingSkill, setSavingSkill] = useState(false);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);

  const myName = myProfile ? fullName(myProfile) : "Siz";

  // Group sessions
  const activeSwaps = sessions.filter((s) => s.status === "accepted");
  const incomingRequests = sessions.filter(
    (s) => s.partner_id === user.id && s.status === "pending",
  );
  const sentRequests = sessions.filter((s) => s.requester_id === user.id && s.status === "pending");

  const getPartner = (s: SwapSession) => {
    const partnerId = s.requester_id === user.id ? s.partner_id : s.requester_id;
    return allProfiles.find((p) => p.id === partnerId);
  };

  // Add a skill
  const handleAddSkill = async (kind: SkillKind, value: string) => {
    const skill = value.trim();
    if (!skill) return;

    // Check if already in profile
    const existing = kind === "teach" ? myProfile?.teach : myProfile?.learn;
    if (existing?.some((s) => s.toLowerCase() === skill.toLowerCase())) {
      toast.info(`«${skill}» ko‘nikmasi profilingizda allaqachon mavjud.`);
      if (kind === "teach") setTeachInput("");
      else setLearnInput("");
      return;
    }

    setSavingSkill(true);
    const { error } = await supabase.from("user_skills").insert({ user_id: user.id, skill, kind });
    setSavingSkill(false);

    if (error && !error.message.includes("duplicate")) {
      toast.error(`Ko‘nikmani qo‘shib bo‘lmadi: ${error.message}`);
      return;
    }

    if (kind === "teach") setTeachInput("");
    else setLearnInput("");

    toast.success(`«${skill}» muvaffaqiyatli qo‘shildi!`);
    onRefresh();
  };

  // Remove a skill
  const handleRemoveSkill = async (kind: SkillKind, skill: string) => {
    setSavingSkill(true);
    const { error } = await supabase
      .from("user_skills")
      .delete()
      .eq("user_id", user.id)
      .eq("kind", kind)
      .eq("skill", skill);
    setSavingSkill(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.info(`«${skill}» olib tashlandi.`);
    onRefresh();
  };

  // Accept incoming request
  const handleAcceptRequest = async (s: SwapSession) => {
    setActiveActionId(s.id);
    const { error } = await supabase
      .from("swap_sessions")
      .update({ status: "accepted" })
      .eq("id", s.id);
    setActiveActionId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Almashinuv so‘rovi qabul qilindi! Chat va video dars faollashdi.");
    onRefresh();
  };

  // Decline or cancel request
  const handleDeclineRequest = async (s: SwapSession, isIncoming: boolean) => {
    setActiveActionId(s.id);
    const { error } = await supabase.from("swap_sessions").delete().eq("id", s.id);
    setActiveActionId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    if (isIncoming) {
      toast.info("So‘rov rad etildi.");
    } else {
      toast.info("Yuborilgan so‘rov bekor qilindi.");
    }
    onRefresh();
  };

  return (
    <div className="surface-card rounded-2xl p-5 sm:p-6 border border-border/60 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/50 pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Repeat2 className="size-5 text-accent" />
            Almashinuvlar va Ko‘nikmalar boshqaruvi
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Faol mashg‘ulotlaringizni kuzating, yangi so‘rovlarni qabul qiling va ko‘nikmalaringizni
            tahrirlang.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button asChild size="sm" variant="outline" className="gap-1.5 text-xs">
            <Link to="/matches">
              <Sparkles className="size-3.5 text-accent" />
              Yangi hamkor topish
            </Link>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 sm:grid-cols-5 h-auto p-1 bg-secondary/60 rounded-xl gap-1">
          <TabsTrigger
            value="active"
            className="text-xs sm:text-sm py-2 px-3 data-[state=open]:bg-card data-[state=open]:shadow-sm rounded-lg flex items-center justify-center gap-1.5"
          >
            <Repeat2 className="size-3.5 text-emerald-400" />
            <span>Faol almashinuvlar</span>
            <span className="ml-1 rounded-full bg-emerald-500/20 px-1.5 py-0.2 text-[11px] font-semibold text-emerald-400">
              {activeSwaps.length}
            </span>
          </TabsTrigger>

          <TabsTrigger
            value="incoming"
            className="text-xs sm:text-sm py-2 px-3 data-[state=open]:bg-card data-[state=open]:shadow-sm rounded-lg flex items-center justify-center gap-1.5"
          >
            <Inbox className="size-3.5 text-sky-400" />
            <span>Kelgan so‘rovlar</span>
            {incomingRequests.length > 0 && (
              <span className="ml-1 rounded-full bg-sky-500/20 px-1.5 py-0.2 text-[11px] font-semibold text-sky-400 animate-pulse">
                {incomingRequests.length}
              </span>
            )}
          </TabsTrigger>

          <TabsTrigger
            value="outgoing"
            className="text-xs sm:text-sm py-2 px-3 data-[state=open]:bg-card data-[state=open]:shadow-sm rounded-lg flex items-center justify-center gap-1.5"
          >
            <Send className="size-3.5 text-amber-400" />
            <span>Yuborilgan</span>
            <span className="ml-1 rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[11px] font-semibold text-amber-400">
              {sentRequests.length}
            </span>
          </TabsTrigger>

          <TabsTrigger
            value="chat"
            className="text-xs sm:text-sm py-2 px-3 data-[state=open]:bg-card data-[state=open]:shadow-sm rounded-lg flex items-center justify-center gap-1.5"
          >
            <MessageSquare className="size-3.5 text-indigo-400" />
            <span>Logistika & Chat</span>
            <span className="ml-1 rounded-full bg-indigo-500/20 px-1.5 py-0.2 text-[11px] font-semibold text-indigo-400">
              {activeSwaps.length}
            </span>
          </TabsTrigger>

          <TabsTrigger
            value="skills"
            className="text-xs sm:text-sm py-2 px-3 data-[state=open]:bg-card data-[state=open]:shadow-sm rounded-lg flex items-center justify-center gap-1.5"
          >
            <GraduationCap className="size-3.5 text-accent" />
            <span>Ko‘nikmalarim</span>
            <span className="ml-1 rounded-full bg-accent/20 px-1.5 py-0.2 text-[11px] font-semibold text-accent">
              {(myProfile?.teach.length ?? 0) + (myProfile?.learn.length ?? 0)}
            </span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: ACTIVE SWAPS */}
        <TabsContent value="active" className="mt-5 space-y-4">
          {activeSwaps.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 p-8 text-center space-y-3 bg-secondary/20">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <Repeat2 className="size-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                Hozircha faol almashinuvlar yo‘q
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
                Hamkorlar bilan kelishilgan darslar va video suhbatlar shu yerda ko‘rinadi. Hamkor
                toping va ilk almashinuvni boshlang!
              </p>
              <Button asChild size="sm" className="mt-2">
                <Link to="/matches">Hamkor qidirish</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {activeSwaps.map((s) => {
                const partner = getPartner(s);
                const isRequester = s.requester_id === user.id;
                const mySkill = isRequester ? s.requester_teaches : s.partner_teaches;
                const theirSkill = isRequester ? s.partner_teaches : s.requester_teaches;

                return (
                  <div
                    key={s.id}
                    className="rounded-xl border border-border/60 bg-card p-4 sm:p-5 flex flex-col justify-between space-y-4 hover:border-accent/40 transition-colors shadow-sm"
                  >
                    <div>
                      {/* Partner info and date */}
                      <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex size-9 items-center justify-center rounded-full bg-secondary font-semibold text-xs border border-border/60">
                            {partner ? initials(partner) : "P"}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-foreground leading-tight">
                              {partner ? fullName(partner) : "PeerSwap hamkori"}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {formatDate(s.created_at)} dan beri faol
                            </p>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
                          <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Faol
                        </span>
                      </div>

                      {/* Skill exchange comparison */}
                      <div className="mt-3.5 space-y-2">
                        <div className="flex items-center justify-between text-xs bg-secondary/40 p-2.5 rounded-lg border border-border/40">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <GraduationCap className="size-3.5 text-emerald-400" />
                            Siz o‘rgatasiz:
                          </span>
                          <span className="font-semibold text-foreground text-right">
                            {mySkill}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs bg-secondary/40 p-2.5 rounded-lg border border-border/40">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <Lightbulb className="size-3.5 text-sky-400" />
                            Hamkor o‘rgatadi:
                          </span>
                          <span className="font-semibold text-foreground text-right">
                            {theirSkill}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setSelectedChatSessionId(s.id);
                          setChatSession(s);
                        }}
                        className="flex-1 gap-1.5 text-xs h-9"
                      >
                        <MessageSquare className="size-3.5 text-indigo-400" />
                        Chat & Logistika
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setVideoSession(s)}
                        className="flex-1 gap-1.5 text-xs h-9 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                      >
                        <Video className="size-3.5" />
                        Video dars
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setReviewSession(s)}
                        className="gap-1.5 text-xs h-9 border-accent/40 text-accent hover:bg-accent/10"
                        title="Darsni yakunlash va baho berish"
                      >
                        <Star className="size-3.5" />
                        Yakunlash
                      </Button>
                      <Button
                        asChild
                        size="sm"
                        variant="ghost"
                        className="h-9 px-2 text-xs"
                        title="Kalendarda ko‘rish"
                      >
                        <Link to="/calendar">
                          <Calendar className="size-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: INCOMING REQUESTS */}
        <TabsContent value="incoming" className="mt-5 space-y-4">
          {incomingRequests.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 p-8 text-center space-y-3 bg-secondary/20">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <Inbox className="size-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">Yangi so‘rovlar yo‘q</h3>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
                Boshqa foydalanuvchilar sizning ko‘nikmalaringiz bo‘yicha almashinuv so‘raganda, bu
                yerda ko‘rinadi.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {incomingRequests.map((s) => {
                const partner = getPartner(s);
                const isBusy = activeActionId === s.id;

                return (
                  <div
                    key={s.id}
                    className="rounded-xl border border-sky-500/30 bg-sky-950/10 p-5 flex flex-col justify-between space-y-4 shadow-sm"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex size-9 items-center justify-center rounded-full bg-secondary font-semibold text-xs border border-border/60">
                            {partner ? initials(partner) : "P"}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-foreground leading-tight">
                              {partner ? fullName(partner) : "PeerSwap a’zosi"}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {formatDate(s.created_at)}
                            </p>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2.5 py-0.5 text-[11px] font-medium text-sky-400 border border-sky-500/20">
                          Taklif yubordi
                        </span>
                      </div>

                      <div className="mt-3 space-y-2 text-xs">
                        <p className="text-muted-foreground">
                          Sizdan o‘rganmoqchi:{" "}
                          <span className="font-semibold text-foreground">
                            {s.partner_teaches || "Ko‘nikma kelishiladi"}
                          </span>
                        </p>
                        <p className="text-muted-foreground">
                          O‘rniga o‘rgata oladi:{" "}
                          <span className="font-semibold text-foreground">
                            {s.requester_teaches || "Ko‘nikma kelishiladi"}
                          </span>
                        </p>
                        {partner?.bio && (
                          <p className="text-[11px] text-muted-foreground italic line-clamp-2 pt-1 border-t border-border/30">
                            «{partner.bio}»
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t border-border/40">
                      <Button
                        size="sm"
                        disabled={isBusy}
                        onClick={() => handleAcceptRequest(s)}
                        className="flex-1 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <Check className="size-3.5" />
                        Qabul qilish
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isBusy}
                        onClick={() => handleDeclineRequest(s, true)}
                        className="gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40"
                      >
                        <X className="size-3.5" />
                        Rad etish
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* TAB 3: OUTGOING REQUESTS */}
        <TabsContent value="outgoing" className="mt-5 space-y-4">
          {sentRequests.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 p-8 text-center space-y-3 bg-secondary/20">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <Send className="size-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                Kutilayotgan so‘rovlar yo‘q
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
                Siz hozircha hech kimga yangi so‘rov yubormagansiz. Hamkorlar katalogidan mos
                kishini tanlab, so‘rov yuborishingiz mumkin.
              </p>
              <Button asChild size="sm" className="mt-2">
                <Link to="/matches">Hamkor topish</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {sentRequests.map((s) => {
                const partner = getPartner(s);
                const isBusy = activeActionId === s.id;

                return (
                  <div
                    key={s.id}
                    className="rounded-xl border border-border/60 bg-card p-5 flex flex-col justify-between space-y-4 shadow-sm"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex size-9 items-center justify-center rounded-full bg-secondary font-semibold text-xs border border-border/60">
                            {partner ? initials(partner) : "P"}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-foreground leading-tight">
                              {partner ? fullName(partner) : "PeerSwap a’zosi"}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {formatDate(s.created_at)} da yuborilgan
                            </p>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-medium text-amber-400 border border-amber-500/20">
                          Kutilmoqda
                        </span>
                      </div>

                      <div className="mt-3 space-y-2 text-xs">
                        <p className="text-muted-foreground">
                          Siz o‘rgatmoqchisiz:{" "}
                          <span className="font-semibold text-foreground">
                            {s.requester_teaches || "Kelishiladi"}
                          </span>
                        </p>
                        <p className="text-muted-foreground">
                          Undan o‘rganmoqchisiz:{" "}
                          <span className="font-semibold text-foreground">
                            {s.partner_teaches || "Kelishiladi"}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border/40 flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isBusy}
                        onClick={() => handleDeclineRequest(s, false)}
                        className="text-xs text-muted-foreground hover:text-destructive"
                      >
                        So‘rovni bekor qilish
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* TAB 4: MANAGE PROFILE SKILLS */}
        <TabsContent value="skills" className="mt-5 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* TEACHING SKILLS */}
            <div className="surface-card rounded-xl p-5 border border-emerald-500/20 bg-emerald-950/5 space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                    <GraduationCap className="size-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      O‘rgatadigan ko‘nikmalarim
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Boshqalarga o‘rgatib, PeerPoint ishlab olasiz
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">
                  {myProfile?.teach.length ?? 0} ta
                </span>
              </div>

              {/* Current teach skills */}
              <div className="min-h-[60px] flex flex-wrap gap-2 items-center">
                {(myProfile?.teach ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    Hozircha hech qanday ko‘nikma qo‘shilmagan.
                  </p>
                ) : (
                  myProfile?.teach.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                    >
                      {skill}
                      <button
                        type="button"
                        disabled={savingSkill}
                        onClick={() => handleRemoveSkill("teach", skill)}
                        className="text-emerald-400 hover:text-destructive transition-colors ml-0.5"
                        title="Olib tashlash"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>

              {/* Add input */}
              <div className="flex items-center gap-2">
                <Input
                  value={teachInput}
                  onChange={(e) => setTeachInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleAddSkill("teach", teachInput);
                    }
                  }}
                  placeholder="Yangi ko‘nikma (masalan: React)…"
                  className="h-9 text-xs bg-background"
                />
                <Button
                  size="sm"
                  disabled={!teachInput.trim() || savingSkill}
                  onClick={() => handleAddSkill("teach", teachInput)}
                  className="h-9 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 gap-1"
                >
                  <Plus className="size-3.5" />
                  Qo‘shish
                </Button>
              </div>

              {/* Suggestions */}
              <div>
                <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
                  Tavsiya etilgan ko‘nikmalar:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_TEACH_SUGGESTIONS.map((s) => {
                    const isAdded = myProfile?.teach.some(
                      (t) => t.toLowerCase() === s.toLowerCase(),
                    );
                    if (isAdded) return null;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleAddSkill("teach", s)}
                        className="px-2 py-0.5 rounded text-[11px] bg-secondary/60 hover:bg-emerald-500/20 hover:text-emerald-300 border border-border/50 text-muted-foreground transition-colors"
                      >
                        + {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* LEARNING SKILLS */}
            <div className="surface-card rounded-xl p-5 border border-sky-500/20 bg-sky-950/5 space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400">
                    <Lightbulb className="size-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      O‘rganmoqchi bo‘lganlarim
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Tizim bu bo‘yicha sizga mos ustozlarni topadi
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-sky-400 bg-sky-500/15 px-2 py-0.5 rounded-full">
                  {myProfile?.learn.length ?? 0} ta
                </span>
              </div>

              {/* Current learn skills */}
              <div className="min-h-[60px] flex flex-wrap gap-2 items-center">
                {(myProfile?.learn ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    Hozircha hech qanday ko‘nikma qo‘shilmagan.
                  </p>
                ) : (
                  myProfile?.learn.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-sky-500/15 text-sky-300 border border-sky-500/30"
                    >
                      {skill}
                      <button
                        type="button"
                        disabled={savingSkill}
                        onClick={() => handleRemoveSkill("learn", skill)}
                        className="text-sky-400 hover:text-destructive transition-colors ml-0.5"
                        title="Olib tashlash"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>

              {/* Add input */}
              <div className="flex items-center gap-2">
                <Input
                  value={learnInput}
                  onChange={(e) => setLearnInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleAddSkill("learn", learnInput);
                    }
                  }}
                  placeholder="Yangi fan (masalan: Python)…"
                  className="h-9 text-xs bg-background"
                />
                <Button
                  size="sm"
                  disabled={!learnInput.trim() || savingSkill}
                  onClick={() => handleAddSkill("learn", learnInput)}
                  className="h-9 px-3 text-xs bg-sky-600 hover:bg-sky-700 text-white shrink-0 gap-1"
                >
                  <Plus className="size-3.5" />
                  Qo‘shish
                </Button>
              </div>

              {/* Suggestions */}
              <div>
                <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
                  Tavsiya etilgan qiziqishlar:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_LEARN_SUGGESTIONS.map((s) => {
                    const isAdded = myProfile?.learn.some(
                      (l) => l.toLowerCase() === s.toLowerCase(),
                    );
                    if (isAdded) return null;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleAddSkill("learn", s)}
                        className="px-2 py-0.5 rounded text-[11px] bg-secondary/60 hover:bg-sky-500/20 hover:text-sky-300 border border-border/50 text-muted-foreground transition-colors"
                      >
                        + {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* TAB 5: REALTIME CHAT & LOGISTICS COORDINATION */}
        <TabsContent value="chat" className="mt-5 space-y-4">
          {activeSwaps.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 p-8 text-center space-y-3 bg-secondary/20">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <MessageSquare className="size-6 text-indigo-400" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                Hozircha faol chat mavjud emas
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
                Hamkor bilan so‘rov tasdiqlangach, bu yerda dars vaqti, sanasi va platformasini
                to‘g‘ridan-to‘g‘ri real-vaqtda kelishib olishingiz mumkin bo‘ladi.
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button asChild size="sm">
                  <Link to="/matches">Hamkor qidirish</Link>
                </Button>
                {incomingRequests.length > 0 && (
                  <Button size="sm" variant="outline" onClick={() => setActiveTab("incoming")}>
                    Kelgan so‘rovlarni ko‘rish ({incomingRequests.length})
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Session Selector if multiple */}
              {activeSwaps.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <span className="text-xs font-medium text-muted-foreground shrink-0">
                    Sessiyani tanlang:
                  </span>
                  {activeSwaps.map((s) => {
                    const partner = getPartner(s);
                    const isSelected = (selectedChatSessionId ?? activeSwaps[0].id) === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedChatSessionId(s.id)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs whitespace-nowrap transition-colors ${
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary font-medium shadow-xs"
                            : "bg-card hover:bg-secondary text-foreground border-border"
                        }`}
                      >
                        <span className="size-2 rounded-full bg-emerald-400" />
                        <span>{partner ? fullName(partner) : "Hamkor"}</span>
                        <span className="opacity-70">
                          ({s.requester_id === user.id ? s.partner_teaches : s.requester_teaches})
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Embedded Realtime Chat */}
              {(() => {
                const targetSession =
                  activeSwaps.find((s) => s.id === selectedChatSessionId) ?? activeSwaps[0];
                if (!targetSession) return null;
                const partner = getPartner(targetSession);
                const skill =
                  targetSession.requester_id === user.id
                    ? `${targetSession.requester_teaches} ↔ ${targetSession.partner_teaches}`
                    : `${targetSession.partner_teaches} ↔ ${targetSession.requester_teaches}`;

                return (
                  <div className="h-[620px] max-h-[82vh]">
                    <RealtimeSessionChat
                      sessionId={targetSession.id}
                      userId={user.id}
                      userName={myName}
                      partnerId={
                        targetSession.requester_id === user.id
                          ? targetSession.partner_id
                          : targetSession.requester_id
                      }
                      partnerName={partner ? fullName(partner) : "PeerSwap hamkori"}
                      partnerAvatar={partner?.avatar_url}
                      skillName={skill}
                      onOpenVideoCall={() => setVideoSession(targetSession)}
                      onLogisticsConfirmed={(details) => {
                        toast.success(`Dars vaqti belgilandi: ${details.date} ${details.time}`);
                      }}
                      className="h-full shadow-sm"
                    />
                  </div>
                );
              })()}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* MODALS */}
      {/* 1. CHAT MODAL */}
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
            getPartner(chatSession) ? fullName(getPartner(chatSession)!) : "PeerSwap hamkori"
          }
          skillName={
            chatSession.requester_id === user.id
              ? `${chatSession.requester_teaches} ↔ ${chatSession.partner_teaches}`
              : `${chatSession.partner_teaches} ↔ ${chatSession.requester_teaches}`
          }
          onOpenVideoCall={() => {
            const current = chatSession;
            setChatSession(null);
            setVideoSession(current);
          }}
        />
      )}

      {/* 2. VIDEO SESSION MODAL */}
      {videoSession && (
        <VideoSessionModal
          isOpen={!!videoSession}
          onClose={() => setVideoSession(null)}
          sessionId={videoSession.id}
          userId={user.id}
          userName={myName}
          isOwner={videoSession.requester_id === user.id}
          partnerId={
            videoSession.requester_id === user.id
              ? videoSession.partner_id
              : videoSession.requester_id
          }
          partnerName={
            getPartner(videoSession) ? fullName(getPartner(videoSession)!) : "PeerSwap hamkori"
          }
          skillName={
            videoSession.requester_id === user.id
              ? videoSession.requester_teaches
              : videoSession.partner_teaches
          }
          onSessionEnded={() => {
            const current = videoSession;
            setVideoSession(null);
            setReviewSession(current);
          }}
        />
      )}

      {/* 3. REVIEW & COMPLETION MODAL */}
      {reviewSession && (
        <SessionReviewModal
          isOpen={!!reviewSession}
          onClose={() => setReviewSession(null)}
          sessionId={reviewSession.id}
          userId={user.id}
          isOwner={reviewSession.requester_id === user.id}
          partnerName={
            getPartner(reviewSession) ? fullName(getPartner(reviewSession)!) : "PeerSwap hamkori"
          }
          skillName={
            reviewSession.requester_id === user.id
              ? reviewSession.partner_teaches
              : reviewSession.requester_teaches
          }
          onCompleted={() => {
            setReviewSession(null);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}
