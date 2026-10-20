import { getFunctions, httpsCallable } from "firebase/functions";
import { app, auth, db } from "./firebase";
import { collection, doc, setDoc, updateDoc } from "firebase/firestore";

export const functions = getFunctions(app);

export type CreateSwapRequestResult = {
  success: boolean;
  sessionId: string;
  plan: "free" | "premium" | "pro";
  weeklyLessonsUsed: number;
  remaining: number | null;
  message: string;
};

export type ConfirmAttendanceResult = {
  success: boolean;
  bothConfirmed?: boolean;
  settled?: boolean;
  noShowRecorded?: boolean;
  status?: string;
  message?: string;
  alreadyCompleted?: boolean;
};

export type ReportUserPayload = {
  reportedUserId: string;
  sessionId?: string;
  reason: "no_show" | "inappropriate_behavior" | "cheating" | "spam" | "other";
  details: string;
};

/**
 * 1. completeSession(sessionId): callable
 * Verifies both participants confirmed, then runs a Firestore transaction:
 * deducts 1 PeerPoint from learner, adds 1 to teacher, sets status "completed" and completed_at.
 * Idempotent (never pays twice), rejects if learner has 0 points.
 */
export async function callCompleteSession(sessionId: string): Promise<{
  success: boolean;
  alreadyCompleted?: boolean;
  message: string;
}> {
  try {
    const fn = httpsCallable<
      { sessionId: string },
      { success: boolean; alreadyCompleted?: boolean; message: string }
    >(functions, "completeSession");
    const result = await fn({ sessionId });
    return result.data;
  } catch (err: unknown) {
    // If backend is unreachable or local development fallback
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[PeerSwap Economy] Functions completeSession error:", msg);
    throw new Error(msg);
  }
}

/**
 * 2. Weekly limits: free = 3 lessons/week, premium = 15 PeerPoints/week, pro = unlimited.
 * Enforced on the server when a swap request is created.
 */
export async function callCreateSwapRequest(data: {
  partnerId: string;
  requesterTeaches?: string;
  partnerTeaches?: string;
  learnerId?: string;
  teacherId?: string;
}): Promise<CreateSwapRequestResult> {
  try {
    const fn = httpsCallable<typeof data, CreateSwapRequestResult>(functions, "createSwapRequest");
    const res = await fn(data);
    return res.data;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[PeerSwap Economy] Functions createSwapRequest:", msg);
    throw new Error(msg);
  }
}

/**
 * 3. Attendance & Confirmation / No-show abuse handling.
 */
export async function callConfirmSessionAttendance(data: {
  sessionId: string;
  didAttend: boolean;
  isNoShow?: boolean;
  reason?: string;
}): Promise<ConfirmAttendanceResult> {
  try {
    const fn = httpsCallable<typeof data, ConfirmAttendanceResult>(
      functions,
      "confirmSessionAttendance",
    );
    const res = await fn(data);
    return res.data;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[PeerSwap Economy] Functions confirmSessionAttendance:", msg);
    throw new Error(msg);
  }
}

/**
 * 3. Abuse handling: Report user callable
 * Writes to "reports" collection (admin-only read in firestore.rules).
 */
export async function callReportUser(data: ReportUserPayload): Promise<{
  success: boolean;
  reportId: string;
  message: string;
}> {
  try {
    const fn = httpsCallable<
      ReportUserPayload,
      { success: boolean; reportId: string; message: string }
    >(functions, "reportUser");
    const res = await fn(data);
    return res.data;
  } catch (err: unknown) {
    // Client-side fallback write to reports collection (allowed by firestore.rules)
    try {
      const reportId = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await setDoc(doc(db, "reports", reportId), {
        id: reportId,
        reporter_id: auth.currentUser?.uid || "user",
        reported_user_id: data.reportedUserId,
        session_id: data.sessionId || null,
        reason: data.reason,
        details: data.details,
        status: "pending",
        created_at: new Date().toISOString(),
      });
      return {
        success: true,
        reportId,
        message: "Shikoyatingiz qabul qilindi. Ma’murlar tez orada ko‘rib chiqadi.",
      };
    } catch {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(msg);
    }
  }
}

/**
 * 4. Request Subscription Upgrade
 * Safely registers a plan upgrade request without client-side self-activation.
 * Falls back to direct Firestore request write (allowed by security rules) if backend is offline.
 */
export async function callRequestPlanUpgrade(plan: "premium" | "pro"): Promise<{
  success: boolean;
  status: string;
  message: string;
}> {
  try {
    const fn = httpsCallable<
      { plan: "premium" | "pro" },
      {
        success: boolean;
        status: string;
        message: string;
      }
    >(functions, "requestSubscriptionUpgrade");
    const res = await fn({ plan });
    return res.data;
  } catch (err: unknown) {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) {
      throw new Error("Tarifni yangilash uchun tizimga kirgan bo‘lishingiz lozim.");
    }

    try {
      const requestId = `subreq_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await setDoc(doc(db, "subscription_requests", requestId), {
        id: requestId,
        user_id: currentUid,
        user_email: auth.currentUser?.email || "",
        target_plan: plan,
        status: "pending_payment",
        created_at: new Date().toISOString(),
        note: "Awaiting payment gateway integration. Plan not activated.",
      });

      return {
        success: true,
        status: "pending_payment",
        message:
          "To‘lov tizimlari (Click / Payme) integratsiyasi jarayonda. Qiziqishingiz qayd etildi, pullik xizmatlar rasman ochilgach sizga xabar beramiz.",
      };
    } catch {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(msg);
    }
  }
}

/**
 * 5. Cancel Paid Subscription (Downgrade to Free)
 * Allows paid users to safely revert to Free.
 */
export async function callCancelSubscription(): Promise<{
  success: boolean;
  plan: "free";
  message: string;
}> {
  const fn = httpsCallable<void, { success: boolean; plan: "free"; message: string }>(
    functions,
    "cancelSubscription",
  );
  const res = await fn();
  return res.data;
}

/**
 * 6. Admin Set User Plan
 * Administrator can change user's plan securely.
 */
export async function callAdminSetUserPlan(
  targetUserId: string,
  plan: "free" | "premium" | "pro",
): Promise<{
  success: boolean;
  userId: string;
  plan: "free" | "premium" | "pro";
  message: string;
}> {
  const fn = httpsCallable<
    { targetUserId: string; plan: "free" | "premium" | "pro" },
    { success: boolean; userId: string; plan: "free" | "premium" | "pro"; message: string }
  >(functions, "adminSetUserPlan");
  const res = await fn({ targetUserId, plan });
  return res.data;
}
