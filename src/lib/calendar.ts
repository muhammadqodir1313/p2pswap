import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";
import { db, auth, handleFirestoreError, OperationType } from "./firebase";

export type SlotKind = "teach" | "learn" | "personal";
export type SlotStatus =
  "open" | "requested" | "confirmed" | "in_progress" | "completed" | "cancelled";

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
  owner_done: boolean;
  partner_done: boolean;
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
  const colPath = "calendar_slots";
  try {
    const snap = await getDocs(collection(db, colPath));
    const list: CalendarSlot[] = [];
    snap.forEach((d) => {
      const data = d.data();
      const startsAt = data.starts_at || "";
      if (startsAt >= fromISO && startsAt < toISO) {
        list.push({
          id: d.id,
          owner_id: data.owner_id || "",
          partner_id: data.partner_id || null,
          kind: data.kind || "teach",
          skill: data.skill || "",
          description: data.description || "",
          is_online: data.is_online ?? true,
          starts_at: data.starts_at || "",
          ends_at: data.ends_at || "",
          status: data.status || "open",
          peerpoint_cost: data.peerpoint_cost ?? 1,
          created_at: data.created_at || new Date().toISOString(),
          owner_done: data.owner_done ?? false,
          partner_done: data.partner_done ?? false,
        });
      }
    });
    return list.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  } catch (err) {
    console.warn("Error fetching slots from firestore, returning empty list:", err);
    return [];
  }
}

export async function fetchUpcomingSlots(userId: string): Promise<CalendarSlot[]> {
  const colPath = "calendar_slots";
  try {
    const snap = await getDocs(collection(db, colPath));
    const nowIso = new Date().toISOString();
    const list: CalendarSlot[] = [];
    snap.forEach((d) => {
      const data = d.data();
      if (
        (data.owner_id === userId || data.partner_id === userId) &&
        data.ends_at >= nowIso &&
        data.status !== "cancelled"
      ) {
        list.push({
          id: d.id,
          owner_id: data.owner_id || "",
          partner_id: data.partner_id || null,
          kind: data.kind || "teach",
          skill: data.skill || "",
          description: data.description || "",
          is_online: data.is_online ?? true,
          starts_at: data.starts_at || "",
          ends_at: data.ends_at || "",
          status: data.status || "open",
          peerpoint_cost: data.peerpoint_cost ?? 1,
          created_at: data.created_at || new Date().toISOString(),
          owner_done: data.owner_done ?? false,
          partner_done: data.partner_done ?? false,
        });
      }
    });
    return list
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
      .slice(0, 20);
  } catch (err) {
    console.warn("Could not query upcoming slots:", err);
    return [];
  }
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
  const id = `slot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const docPath = `calendar_slots/${id}`;
  try {
    await setDoc(doc(db, "calendar_slots", id), {
      ...slot,
      id,
      partner_id: null,
      status: "open",
      created_at: new Date().toISOString(),
      owner_done: false,
      partner_done: false,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, docPath);
  }
}

export async function updateSlot(id: string, patch: Partial<NewSlot>): Promise<void> {
  const docPath = `calendar_slots/${id}`;
  try {
    await updateDoc(doc(db, "calendar_slots", id), patch);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, docPath);
  }
}

export async function deleteSlot(id: string): Promise<void> {
  const docPath = `calendar_slots/${id}`;
  try {
    await deleteDoc(doc(db, "calendar_slots", id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, docPath);
  }
}

export async function joinSlot(id: string): Promise<void> {
  const currentUserId = auth.currentUser?.uid;
  if (!currentUserId) throw new Error("Foydalanuvchi tizimga kirmagan");
  const docPath = `calendar_slots/${id}`;
  try {
    await updateDoc(doc(db, "calendar_slots", id), {
      partner_id: currentUserId,
      status: "requested",
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, docPath);
  }
}

export async function setSlotStatus(id: string, status: SlotStatus): Promise<void> {
  const docPath = `calendar_slots/${id}`;
  try {
    await updateDoc(doc(db, "calendar_slots", id), { status });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, docPath);
  }
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
