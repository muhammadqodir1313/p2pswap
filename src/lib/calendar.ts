import { supabase } from "@/integrations/supabase/client";

export type SlotKind = "teach" | "learn" | "personal";
export type SlotStatus =
  | "open"
  | "requested"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled";

export type CalendarSlot = {
  id: string;
  owner_id: string;
  partner_id: string | null;
  kind: SlotKind;
  skill: string;
  description: string;
  is_online: boolean;
  starts_at: string;
  ends_at: string;
  status: SlotStatus;
  peerpoint_cost: number;
  created_at: string;
};

export const KIND_LABEL: Record<SlotKind, string> = {
  teach: "O‘rgataman",
  learn: "O‘rganaman",
  personal: "Shaxsiy",
};

export const STATUS_LABEL: Record<SlotStatus, string> = {
  open: "Ochiq",
  requested: "So‘ralgan",
  confirmed: "Tasdiqlangan",
  in_progress: "Jarayonda",
  completed: "Yakunlangan",
  cancelled: "Bekor qilingan",
};

/** Green = teach, blue = learn, purple = booked, gray = personal/cancelled. */
export function slotColor(slot: CalendarSlot) {
  if (slot.status === "cancelled") return "border-muted bg-muted/40 text-muted-foreground";
  if (slot.kind === "personal") return "border-muted-foreground/30 bg-muted/60 text-foreground";
  if (slot.partner_id) return "border-purple-500/40 bg-purple-500/20 text-foreground";
  if (slot.kind === "teach") return "border-emerald-500/40 bg-emerald-500/20 text-foreground";
  return "border-sky-500/40 bg-sky-500/20 text-foreground";
}

export async function fetchSlots(fromISO: string, toISO: string): Promise<CalendarSlot[]> {
  const { data, error } = await supabase
    .from("calendar_slots")
    .select("*")
    .gte("starts_at", fromISO)
    .lt("starts_at", toISO)
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CalendarSlot[];
}

export async function fetchUpcomingSlots(userId: string): Promise<CalendarSlot[]> {
  const { data, error } = await supabase
    .from("calendar_slots")
    .select("*")
    .or(`owner_id.eq.${userId},partner_id.eq.${userId}`)
    .gte("ends_at", new Date().toISOString())
    .neq("status", "cancelled")
    .order("starts_at", { ascending: true })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as CalendarSlot[];
}

export type NewSlot = {
  owner_id: string;
  kind: SlotKind;
  skill: string;
  description: string;
  is_online: boolean;
  starts_at: string;
  ends_at: string;
  peerpoint_cost: number;
};

export async function createSlot(slot: NewSlot): Promise<void> {
  const { error } = await supabase.from("calendar_slots").insert(slot);
  if (error) throw error;
}

export async function updateSlot(id: string, patch: Partial<NewSlot>): Promise<void> {
  const { error } = await supabase.from("calendar_slots").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteSlot(id: string): Promise<void> {
  const { error } = await supabase.from("calendar_slots").delete().eq("id", id);
  if (error) throw error;
}

export async function joinSlot(id: string): Promise<void> {
  const { error } = await supabase.rpc("join_calendar_slot", { _slot_id: id });
  if (error) throw error;
}

export async function setSlotStatus(id: string, status: SlotStatus): Promise<void> {
  const { error } = await supabase.rpc("set_calendar_slot_status", {
    _slot_id: id,
    _status: status,
  });
  if (error) throw error;
}

/* ---------- date helpers (local time) ---------- */

export function startOfWeek(d: Date): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = (date.getDay() + 6) % 7; // Monday = 0
  date.setDate(date.getDate() - day);
  return date;
}

export function addDays(d: Date, n: number): Date {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

export const DAY_NAMES = ["Du", "Se", "Chor", "Pay", "Jum", "Shan", "Yak"];

export function toDateInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toTimeInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function combine(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  return new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
}

export function timeRange(slot: CalendarSlot) {
  return `${toTimeInput(new Date(slot.starts_at))} – ${toTimeInput(new Date(slot.ends_at))}`;
}

export function durationMinutes(slot: CalendarSlot) {
  return Math.round(
    (new Date(slot.ends_at).getTime() - new Date(slot.starts_at).getTime()) / 60000,
  );
}

export function formatDayLabel(d: Date) {
  return d.toLocaleDateString("uz-UZ", { day: "numeric", month: "long" });
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
