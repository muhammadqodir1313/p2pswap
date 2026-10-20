import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { supabase } from "@/integrations/supabase/client";

export type LogisticsProposal = {
  proposedDate?: string; // e.g. "2026-10-10"
  proposedTime?: string; // e.g. "19:00"
  platform?: "peerswap" | "google_meet" | "zoom" | "telegram" | "offline";
  agenda?: string;
  status?: "pending" | "accepted" | "declined";
};

export type ChatMessage = {
  id: string;
  sessionId: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
  type?: "message" | "system" | "logistics_proposal" | "logistics_accepted";
  logistics?: LogisticsProposal;
};

export type SessionRecording = {
  id: string;
  sessionId: string;
  title: string;
  videoUrl: string;
  durationSeconds: number;
  sizeBytes: number;
  createdAt: string;
};

export type SessionAttendance = {
  sessionId: string;
  ownerAttended: boolean;
  partnerAttended: boolean;
  updatedAt: string;
};

// --- Firestore Persistent Chat API (swap_sessions/{sessionId}/messages/{messageId}) ---

function getSessionMessagesCollection(sessionId: string) {
  if (sessionId.startsWith("demo-slot-") || sessionId.startsWith("slot_")) {
    return collection(db, "calendar_slots", sessionId, "messages");
  }
  return collection(db, "swap_sessions", sessionId, "messages");
}

function getSessionMessageDoc(sessionId: string, messageId: string) {
  if (sessionId.startsWith("demo-slot-") || sessionId.startsWith("slot_")) {
    return doc(db, "calendar_slots", sessionId, "messages", messageId);
  }
  return doc(db, "swap_sessions", sessionId, "messages", messageId);
}

/**
 * Real-time listener for session messages from Firestore.
 * Subscribes via onSnapshot, ordered chronologically by createdAt.
 * Handles unresolved server timestamps gracefully via { serverTimestamps: "estimate" }.
 */
export function subscribeSessionMessages(
  sessionId: string,
  onUpdate: (messages: ChatMessage[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const colRef = getSessionMessagesCollection(sessionId);
  const q = query(colRef, orderBy("createdAt", "asc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const msgs: ChatMessage[] = [];
      const seenIds = new Set<string>();
      snapshot.forEach((d) => {
        if (seenIds.has(d.id)) return;
        seenIds.add(d.id);
        const data = d.data({ serverTimestamps: "estimate" });

        let createdAtIso: string;
        if (data.createdAt instanceof Timestamp) {
          createdAtIso = data.createdAt.toDate().toISOString();
        } else if (typeof data.createdAt === "string") {
          createdAtIso = data.createdAt;
        } else if (data.createdAt && typeof data.createdAt.toDate === "function") {
          createdAtIso = data.createdAt.toDate().toISOString();
        } else {
          createdAtIso = new Date().toISOString();
        }

        msgs.push({
          id: d.id,
          sessionId: data.sessionId || sessionId,
          senderId: data.senderId || "",
          senderName: data.senderName || "PeerSwap a’zosi",
          text: data.text || "",
          createdAt: createdAtIso,
          type: data.type || "message",
          ...(data.logistics ? { logistics: data.logistics } : {}),
        });
      });
      onUpdate(msgs);
    },
    (err) => {
      console.error("[PeerSwap Chat] Firestore onSnapshot error:", err);
      onError?.(err instanceof Error ? err : new Error(String(err)));
    },
  );
}

/**
 * Send a message to Firestore with server timestamp.
 * Enforces senderId matching current authenticated user and length limits.
 */
export async function sendSessionChatMessage(
  sessionId: string,
  message: {
    sessionId: string;
    senderId: string;
    senderName: string;
    text: string;
    type?: "message" | "system" | "logistics_proposal" | "logistics_accepted";
    logistics?: LogisticsProposal;
  },
): Promise<string> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    throw new Error("Xabar yuborish uchun tizimga kirgan bo‘lishingiz lozim.");
  }

  const trimmedText = message.text.trim();
  if (!trimmedText) {
    throw new Error("Bo‘sh xabar yuborib bo‘lmaydi.");
  }
  if (trimmedText.length > 4000) {
    throw new Error("Xabar matni juda uzun (maksimal 4000 ta belgi).");
  }

  const colRef = getSessionMessagesCollection(sessionId);
  const docRef = doc(colRef);

  const payload: Record<string, unknown> = {
    id: docRef.id,
    sessionId,
    senderId: currentUid,
    senderName: message.senderName || "PeerSwap a’zosi",
    text: trimmedText,
    createdAt: serverTimestamp(),
    type: message.type || "message",
  };

  if (message.logistics) {
    payload.logistics = message.logistics;
  }

  await setDoc(docRef, payload);
  return docRef.id;
}

/**
 * Update an existing message in Firestore (e.g. logistics proposal status).
 */
export async function updateSessionChatMessage(
  sessionId: string,
  messageId: string,
  updates: {
    logistics?: LogisticsProposal;
  },
): Promise<void> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    throw new Error("Amalni bajarish uchun tizimga kirgan bo‘lishingiz lozim.");
  }

  const docRef = getSessionMessageDoc(sessionId, messageId);
  const updatePayload: Record<string, unknown> = {};
  if (updates.logistics) {
    updatePayload.logistics = updates.logistics;
  }

  await updateDoc(docRef, updatePayload);
}

// --- LocalStorage & IndexedDB helpers for reliable media & chat storage ---
const CHAT_STORAGE_KEY = "peerswap_chat_history_v1";
const ATTENDANCE_STORAGE_KEY = "peerswap_attendance_v1";
const DB_NAME = "peerswap_recordings_db";
const STORE_NAME = "recordings";

function openRecordingsDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB not supported"));
    }
    const req = window.indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function getLocalChatHistory(sessionId: string): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${CHAT_STORAGE_KEY}_${sessionId}`);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalChatMessage(message: ChatMessage): void {
  if (typeof window === "undefined") return;
  try {
    const current = getLocalChatHistory(message.sessionId);
    // Avoid duplicate id
    if (!current.some((m) => m.id === message.id)) {
      current.push(message);
      localStorage.setItem(`${CHAT_STORAGE_KEY}_${message.sessionId}`, JSON.stringify(current));
    }
  } catch (err) {
    console.error("Failed to save chat message to localStorage", err);
  }
}

export function updateLocalChatMessage(
  sessionId: string,
  messageId: string,
  updates: Partial<ChatMessage>,
): void {
  if (typeof window === "undefined") return;
  try {
    const current = getLocalChatHistory(sessionId);
    const index = current.findIndex((m) => m.id === messageId);
    if (index !== -1) {
      current[index] = { ...current[index], ...updates };
      localStorage.setItem(`${CHAT_STORAGE_KEY}_${sessionId}`, JSON.stringify(current));
    }
  } catch (err) {
    console.error("Failed to update chat message in localStorage", err);
  }
}

export async function saveSessionRecording(params: {
  sessionId: string;
  title: string;
  blob: Blob;
  durationSeconds: number;
}): Promise<SessionRecording> {
  const id = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const recordingItem = {
    id,
    sessionId: params.sessionId,
    title: params.title,
    blob: params.blob,
    durationSeconds: params.durationSeconds,
    sizeBytes: params.blob.size,
    createdAt: new Date().toISOString(),
  };

  try {
    const db = await openRecordingsDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(recordingItem);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("Could not save blob into IndexedDB, falling back to memory/blob URL", err);
  }

  const videoUrl = URL.createObjectURL(params.blob);
  return {
    id,
    sessionId: params.sessionId,
    title: params.title,
    videoUrl,
    durationSeconds: params.durationSeconds,
    sizeBytes: params.blob.size,
    createdAt: recordingItem.createdAt,
  };
}

export async function fetchSessionRecordings(sessionId: string): Promise<SessionRecording[]> {
  try {
    const db = await openRecordingsDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const rows = (req.result || []) as Array<{
          id: string;
          sessionId: string;
          title: string;
          blob: Blob;
          durationSeconds: number;
          sizeBytes: number;
          createdAt: string;
        }>;
        const matching = rows
          .filter((r) => r.sessionId === sessionId)
          .map((r) => ({
            id: r.id,
            sessionId: r.sessionId,
            title: r.title,
            videoUrl: URL.createObjectURL(r.blob),
            durationSeconds: r.durationSeconds,
            sizeBytes: r.sizeBytes,
            createdAt: r.createdAt,
          }));
        resolve(matching);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function deleteSessionRecording(id: string): Promise<void> {
  try {
    const db = await openRecordingsDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("Failed to delete recording", err);
  }
}

// --- Attendance Management to prevent unfair coin deduction ---
export function getAttendanceState(sessionId: string): SessionAttendance {
  if (typeof window === "undefined") {
    return {
      sessionId,
      ownerAttended: false,
      partnerAttended: false,
      updatedAt: new Date().toISOString(),
    };
  }
  try {
    const raw = localStorage.getItem(`${ATTENDANCE_STORAGE_KEY}_${sessionId}`);
    if (raw) return JSON.parse(raw);
  } catch {
    // Return default fallback
  }
  return {
    sessionId,
    ownerAttended: false,
    partnerAttended: false,
    updatedAt: new Date().toISOString(),
  };
}

export function markUserAttended(sessionId: string, isOwner: boolean): SessionAttendance {
  const current = getAttendanceState(sessionId);
  if (isOwner) {
    current.ownerAttended = true;
  } else {
    current.partnerAttended = true;
  }
  current.updatedAt = new Date().toISOString();
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`${ATTENDANCE_STORAGE_KEY}_${sessionId}`, JSON.stringify(current));
    } catch {
      // Storage unavailable
    }
  }
  return current;
}

// --- Realtime Channel for Messaging & Signaling ---
export function createSessionChannel(
  sessionId: string,
  callbacks: {
    onMessage?: (msg: ChatMessage) => void;
    onMessageUpdated?: (msg: ChatMessage) => void;
    onTyping?: (data: { userId: string; userName: string; isTyping: boolean }) => void;
    onAttendance?: (data: { userId: string; isOwner: boolean }) => void;
    onSignal?: (data: unknown) => void;
  },
) {
  const channel = supabase.channel(`session-room:${sessionId}`, {
    config: { broadcast: { self: false } },
  });

  channel
    .on("broadcast", { event: "chat-message" }, ({ payload }) => {
      const msg = payload as ChatMessage;
      callbacks.onMessage?.(msg);
    })
    .on("broadcast", { event: "chat-message-updated" }, ({ payload }) => {
      const msg = payload as ChatMessage;
      callbacks.onMessageUpdated?.(msg);
    })
    .on("broadcast", { event: "typing" }, ({ payload }) => {
      callbacks.onTyping?.(payload as { userId: string; userName: string; isTyping: boolean });
    })
    .on("broadcast", { event: "attendance" }, ({ payload }) => {
      callbacks.onAttendance?.(payload as { userId: string; isOwner: boolean });
    })
    .on("broadcast", { event: "webrtc-signal" }, ({ payload }) => {
      callbacks.onSignal?.(payload);
    })
    .subscribe();

  return {
    sendMessage: async (msg: ChatMessage) => {
      await sendSessionChatMessage(sessionId, {
        sessionId,
        senderId: msg.senderId,
        senderName: msg.senderName,
        text: msg.text,
        type: msg.type,
        logistics: msg.logistics,
      });
      await channel.send({
        type: "broadcast",
        event: "chat-message",
        payload: msg,
      });
    },
    sendUpdatedMessage: async (msg: ChatMessage) => {
      if (msg.logistics) {
        await updateSessionChatMessage(sessionId, msg.id, {
          logistics: msg.logistics,
        });
      }
      await channel.send({
        type: "broadcast",
        event: "chat-message-updated",
        payload: msg,
      });
    },
    sendTyping: async (data: { userId: string; userName: string; isTyping: boolean }) => {
      await channel.send({
        type: "broadcast",
        event: "typing",
        payload: data,
      });
    },
    broadcastAttendance: async (data: { userId: string; isOwner: boolean }) => {
      await channel.send({
        type: "broadcast",
        event: "attendance",
        payload: data,
      });
    },
    sendSignal: async (signal: unknown) => {
      await channel.send({
        type: "broadcast",
        event: "webrtc-signal",
        payload: signal as { [key: string]: unknown },
      });
    },
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
  };
}
