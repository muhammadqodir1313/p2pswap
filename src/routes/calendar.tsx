import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Globe, MapPin, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth, useRequireAuth } from "@/lib/auth";
import {
  addDays,
  combine,
  createSlot,
  DAY_NAMES,
  deleteSlot,
  durationMinutes,
  fetchSlots,
  formatDayLabel,
  isSameDay,
  joinSlot,
  KIND_LABEL,
  setSlotStatus,
  slotColor,
  startOfWeek,
  STATUS_LABEL,
  timeRange,
  toDateInput,
  toTimeInput,
  updateSlot,
  type CalendarSlot,
  type SlotKind,
} from "@/lib/calendar";
import { fetchProfiles, fetchWeeklyPoints, fullName, type ProfileWithSkills } from "@/lib/peerswap";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Kalendar — PeerSwap" },
      {
        name: "description",
        content: "Haftalik jadval: o‘rgatish va o‘rganish uchun bo‘sh vaqtlaringizni belgilang.",
      },
      { property: "og:title", content: "Kalendar — PeerSwap" },
      {
        property: "og:description",
        content: "Haftalik jadval: o‘rgatish va o‘rganish uchun bo‘sh vaqtlaringizni belgilang.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CalendarPage,
});

const HOUR_START = 7;
const HOUR_END = 22;
const ROW_H = 56;
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

type Draft = {
  id?: string;
  kind: SlotKind;
  skill: string;
  date: string;
  start: string;
  duration: number;
  is_online: boolean;
  description: string;
};

function CalendarPage() {
  const { user } = useRequireAuth();
  const { loading } = useAuth();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selected, setSelected] = useState<CalendarSlot | null>(null);
  const [busy, setBusy] = useState(false);

  const weekEnd = addDays(weekStart, 7);
  const slotsQuery = useQuery({
    queryKey: ["calendar-slots", weekStart.toISOString()],
    queryFn: () => fetchSlots(weekStart.toISOString(), weekEnd.toISOString()),
    enabled: !!user,
  });
  const profilesQuery = useQuery({
    queryKey: ["profiles"],
    queryFn: fetchProfiles,
    enabled: !!user,
  });
  const pointsQuery = useQuery({
    queryKey: ["weekly-points", user?.id],
    queryFn: () => fetchWeeklyPoints(user!.id),
    enabled: !!user,
  });
  const isFree = (pointsQuery.data?.plan ?? "free") === "free";

  const profiles = useMemo(() => profilesQuery.data ?? [], [profilesQuery.data]);
  const nameOf = (id: string | null) => {
    const p = profiles.find((x) => x.id === id);
    return p ? fullName(p) : "PeerSwap a’zosi";
  };

  if (loading || !user) return null;

  const slots = slotsQuery.data ?? [];
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  function openCreate(day: Date, hour: number) {
    setDraft({
      kind: "teach",
      skill: "",
      date: toDateInput(day),
      start: `${String(hour).padStart(2, "0")}:00`,
      duration: 30,
      is_online: true,
      description: "",
    });
  }

  function openEdit(slot: CalendarSlot) {
    setSelected(null);
    setDraft({
      id: slot.id,
      kind: slot.kind,
      skill: slot.skill,
      date: toDateInput(new Date(slot.starts_at)),
      start: toTimeInput(new Date(slot.starts_at)),
      duration: durationMinutes(slot),
      is_online: slot.is_online,
      description: slot.description,
    });
  }

  async function saveDraft() {
    if (!draft) return;
    const skill = draft.skill.trim();
    if (draft.kind !== "personal" && skill.length < 2) {
      toast.error("Ko‘nikma nomini yozing.");
      return;
    }
    if (isFree && draft.kind !== "personal" && draft.duration > 30) {
      toast.error("45 va 60 daqiqalik mashg‘ulotlar uchun obuna kerak.");
      return;
    }
    const starts = combine(draft.date, draft.start);
    const ends = new Date(starts.getTime() + draft.duration * 60000);
    setBusy(true);
    try {
      const payload = {
        kind: draft.kind,
        skill: draft.kind === "personal" ? skill || "Shaxsiy ish" : skill,
        description: draft.description,
        is_online: draft.is_online,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        peerpoint_cost: draft.kind === "personal" ? 0 : 1,
      };
      if (draft.id) {
        await updateSlot(draft.id, payload);
        toast.success("Slot yangilandi.");
      } else {
        await createSlot({ ...payload, owner_id: user!.id });
        toast.success("Yangi slot qo‘shildi.");
      }
      setDraft(null);
      void slotsQuery.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Saqlashning iloji bo‘lmadi.");
    } finally {
      setBusy(false);
    }
  }

  async function act(fn: () => Promise<void>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      setSelected(null);
      void slotsQuery.refetch();
      void profilesQuery.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Amalni bajarishning iloji bo‘lmadi.");
    } finally {
      setBusy(false);
    }
  }

  const recommended: ProfileWithSkills[] = selected
    ? profiles
        .filter((p) => p.id !== selected.owner_id && p.id !== user.id && p.is_active)
        .filter((p) => {
          const skill = selected.skill.trim().toLowerCase();
          if (!skill) return false;
          const list = selected.kind === "learn" ? p.teach : p.learn;
          return list.some((s) => s.trim().toLowerCase().includes(skill));
        })
        .slice(0, 3)
    : [];

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Kalendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDayLabel(weekStart)} – {formatDayLabel(addDays(weekStart, 6))}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Oldingi hafta"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>
            Bu hafta
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Keyingi hafta"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button size="sm" onClick={() => openCreate(new Date(), new Date().getHours())}>
            <Plus className="size-4" />
            Slot qo‘shish
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <Legend className="bg-emerald-500/30" label="O‘rgatish sloti" />
        <Legend className="bg-sky-500/30" label="O‘rganish sloti" />
        <Legend className="bg-purple-500/30" label="Band qilingan mashg‘ulot" />
        <Legend className="bg-muted" label="Shaxsiy voqea" />
      </div>

      <div className="surface-card mt-4 overflow-x-auto p-2">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-border pb-2">
            <div />
            {days.map((d, i) => (
              <div key={i} className="px-1 text-center">
                <p className="text-xs uppercase text-muted-foreground">{DAY_NAMES[i]}</p>
                <p
                  className={
                    "text-sm font-semibold " + (isSameDay(d, new Date()) ? "text-accent" : "")
                  }
                >
                  {d.getDate()}
                </p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[56px_repeat(7,1fr)]">
            <div>
              {HOURS.map((h) => (
                <div
                  key={h}
                  style={{ height: ROW_H }}
                  className="pr-2 text-right text-xs text-muted-foreground"
                >
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>

            {days.map((day, di) => {
              const daySlots = slots.filter((s) => isSameDay(new Date(s.starts_at), day));
              return (
                <div key={di} className="relative border-l border-border">
                  {HOURS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      aria-label={`${formatDayLabel(day)} ${h}:00 uchun slot qo‘shish`}
                      onClick={() => openCreate(day, h)}
                      style={{ height: ROW_H }}
                      className="block w-full border-b border-border/60 transition-colors hover:bg-secondary/60"
                    />
                  ))}
                  {daySlots.map((s) => {
                    const st = new Date(s.starts_at);
                    const top = (st.getHours() - HOUR_START + st.getMinutes() / 60) * ROW_H;
                    const height = Math.max(26, (durationMinutes(s) / 60) * ROW_H - 4);
                    if (top < 0 || top > HOURS.length * ROW_H) return null;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelected(s)}
                        style={{ top, height }}
                        className={
                          "absolute left-1 right-1 overflow-hidden rounded-lg border px-2 py-1 text-left text-xs " +
                          slotColor(s)
                        }
                      >
                        <span className="block font-semibold leading-tight">
                          {s.kind === "personal" ? s.skill : `${KIND_LABEL[s.kind]}: ${s.skill}`}
                        </span>
                        <span className="block opacity-80">{timeRange(s)}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Create / edit dialog */}
      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Slotni tahrirlash" : "Yangi slot"}</DialogTitle>
            <DialogDescription>
              Bo‘sh vaqtingizni belgilang — boshqalar qo‘shila oladi.
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <div className="space-y-4">
              <div>
                <Label>Slot turi</Label>
                <Select
                  value={draft.kind}
                  onValueChange={(v) => setDraft({ ...draft, kind: v as SlotKind })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="teach">O‘rgatmoqchiman</SelectItem>
                    <SelectItem value="learn">O‘rganmoqchiman</SelectItem>
                    <SelectItem value="personal">Shaxsiy voqea</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="skill">{draft.kind === "personal" ? "Sarlavha" : "Ko‘nikma"}</Label>
                <Input
                  id="skill"
                  className="mt-1"
                  value={draft.skill}
                  onChange={(e) => setDraft({ ...draft, skill: e.target.value })}
                  placeholder={draft.kind === "personal" ? "Shaxsiy ish" : "Masalan: SQL"}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="date">Sana</Label>
                  <Input
                    id="date"
                    type="date"
                    className="mt-1"
                    value={draft.date}
                    onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="start">Boshlanishi</Label>
                  <Input
                    id="start"
                    type="time"
                    className="mt-1"
                    value={draft.start}
                    onChange={(e) => setDraft({ ...draft, start: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Davomiyligi</Label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {[30, 45, 60].map((m) => {
                    const locked = isFree && draft.kind !== "personal" && m > 30;
                    return (
                      <Button
                        key={m}
                        type="button"
                        size="sm"
                        variant={draft.duration === m ? "default" : "outline"}
                        disabled={locked}
                        onClick={() => setDraft({ ...draft, duration: m })}
                      >
                        {m} daqiqa{locked ? " 🔒" : ""}
                      </Button>
                    );
                  })}
                </div>
                {isFree && draft.kind !== "personal" ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Bepul tarifda faqat 30 daqiqalik mashg‘ulotlar.{" "}
                    <Link to="/subscription" className="text-primary hover:underline">
                      45 va 60 daqiqa uchun obuna bo‘ling
                    </Link>
                  </p>
                ) : null}
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">{draft.is_online ? "Onlayn" : "Oflayn"}</p>
                  <p className="text-xs text-muted-foreground">Mashg‘ulot qayerda o‘tadi</p>
                </div>
                <Switch
                  checked={draft.is_online}
                  onCheckedChange={(v) => setDraft({ ...draft, is_online: v })}
                />
              </div>
              <div>
                <Label htmlFor="desc">Izoh (ixtiyoriy)</Label>
                <Textarea
                  id="desc"
                  className="mt-1"
                  rows={2}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </div>
              {draft.kind !== "personal" ? (
                <p className="text-xs text-muted-foreground">
                  Narxi: 1 PeerPoint — ball faqat mashg‘ulot yakunlanganda o‘tkaziladi.
                </p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Bekor qilish
            </Button>
            <Button onClick={saveDraft} disabled={busy}>
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Slot details dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {selected.kind === "personal"
                    ? selected.skill
                    : `${KIND_LABEL[selected.kind]}: ${selected.skill}`}
                </DialogTitle>
                <DialogDescription>
                  {formatDayLabel(new Date(selected.starts_at))} · {timeRange(selected)} ·{" "}
                  {durationMinutes(selected)} daqiqa
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2 text-sm">
                <p className="flex items-center gap-2 text-muted-foreground">
                  {selected.is_online ? (
                    <Globe className="size-4" />
                  ) : (
                    <MapPin className="size-4" />
                  )}
                  {selected.is_online ? "Onlayn" : "Oflayn"} · {STATUS_LABEL[selected.status]}
                </p>
                <p>
                  <span className="text-muted-foreground">Egasi:</span> {nameOf(selected.owner_id)}
                </p>
                {selected.partner_id ? (
                  <p>
                    <span className="text-muted-foreground">Hamkor:</span>{" "}
                    {nameOf(selected.partner_id)}
                  </p>
                ) : null}
                {selected.kind !== "personal" ? (
                  <p>
                    <span className="text-muted-foreground">Narxi:</span> {selected.peerpoint_cost}{" "}
                    PeerPoint
                  </p>
                ) : null}
                {selected.description ? (
                  <p className="text-muted-foreground">{selected.description}</p>
                ) : null}
              </div>

              {recommended.length > 0 && selected.status === "open" ? (
                <div className="rounded-lg border border-border p-3">
                  <p className="text-sm font-medium">Tavsiya etilgan hamkorlar</p>
                  <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                    {recommended.map((p) => (
                      <li key={p.id}>
                        {fullName(p)} —{" "}
                        {(selected.kind === "learn" ? p.teach : p.learn).slice(0, 3).join(", ")}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <DialogFooter className="flex-wrap gap-2">
                {(() => {
                  const isOwner = selected.owner_id === user.id;
                  const isMember = isOwner || selected.partner_id === user.id;
                  const started = new Date(selected.starts_at).getTime() <= Date.now();
                  const myDone = isOwner ? selected.owner_done : selected.partner_done;
                  const otherDone = isOwner ? selected.partner_done : selected.owner_done;
                  const active =
                    selected.status === "confirmed" || selected.status === "in_progress";
                  return (
                    <>
                      {isOwner && selected.status === "open" && !selected.partner_id ? (
                        <>
                          <Button variant="outline" onClick={() => openEdit(selected)}>
                            Tahrirlash
                          </Button>
                          <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() => act(() => deleteSlot(selected.id), "Slot o‘chirildi.")}
                          >
                            O‘chirish
                          </Button>
                        </>
                      ) : null}

                      {selected.status === "open" && !isOwner && selected.kind !== "personal" ? (
                        <Button
                          disabled={busy}
                          onClick={() => act(() => joinSlot(selected.id), "Siz qo‘shildingiz!")}
                        >
                          Slotga qo‘shilish
                        </Button>
                      ) : null}

                      {isMember && active && selected.kind !== "personal" ? (
                        started ? (
                          myDone ? (
                            <p className="text-sm text-muted-foreground">
                              Siz tasdiqladingiz.{" "}
                              {otherDone ? "" : "Hamkor tasdiqlashi kutilmoqda."}
                            </p>
                          ) : (
                            <Button
                              disabled={busy}
                              onClick={() =>
                                act(
                                  () => setSlotStatus(selected.id, "completed"),
                                  otherDone
                                    ? "Yakunlandi — PeerPoint o‘tkazildi."
                                    : "Tasdiqlandi. Hamkor ham tasdiqlashi kerak.",
                                )
                              }
                            >
                              Qatnashganimni tasdiqlash
                            </Button>
                          )
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Yakunlash mashg‘ulot boshlangandan keyin ochiladi.
                          </p>
                        )
                      ) : null}

                      {isMember &&
                      !started &&
                      selected.status !== "completed" &&
                      selected.status !== "cancelled" ? (
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            act(() => setSlotStatus(selected.id, "cancelled"), "Bekor qilindi.")
                          }
                        >
                          Bekor qilish
                        </Button>
                      ) : null}
                    </>
                  );
                })()}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={"size-3 rounded " + className} />
      {label}
    </span>
  );
}
