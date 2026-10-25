import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";

const app = initializeApp();

// Target project database id
const databaseId =
  process.env.FIRESTORE_DATABASE_ID || "ai-studio-p2pswap-dd0d3ce1-74df-4783-ac3d-28766ee593b1";

export function getDb() {
  try {
    return getFirestore(app, databaseId);
  } catch {
    return getFirestore(app);
  }
}

// Plan weekly limits
export const PLAN_LIMITS: Record<"free" | "premium" | "pro", number> = {
  free: 3,
  premium: 15,
  pro: Infinity,
};

// Server-controlled administrator emails bootstrap list
const ADMIN_EMAILS = new Set(["farhodjonovichm1301@gmail.com"]);

/**
 * Server-side Admin Verification Helper
 * Strictly verifies admin authorization using server-controlled custom claims,
 * the admins collection document, or verified owner email fallback.
 * Automatically bootstraps admins/{uid} document for verified initial admins
 * to ensure consistency with Firestore Security Rules.
 */
export async function isCallerAdmin(
  auth: { uid: string; token?: Record<string, unknown> } | undefined,
  db: ReturnType<typeof getDb>,
): Promise<boolean> {
  if (!auth) return false;
  // 1. Custom token claim (primary server-controlled role)
  if (auth.token?.admin === true) return true;

  // 2. Admins collection document (server-controlled UID list)
  try {
    const adminDoc = await db.collection("admins").doc(auth.uid).get();
    if (adminDoc.exists) return true;
  } catch {
    // ignore
  }

  // 3. Server-controlled admin UID environment variable
  const adminUidsEnv = process.env.ADMIN_UIDS;
  if (adminUidsEnv) {
    const uids = adminUidsEnv.split(",").map((s) => s.trim());
    if (uids.includes(auth.uid)) return true;
  }

  // 4. Initial admin bootstrap: verified email in server-controlled ADMIN_EMAILS set.
  // Auto-provisions admins/{uid} doc so Firestore Rules' exists(/admins/$(auth.uid))
  // immediately evaluates to true across client queries without split-brain authorization.
  if (
    auth.token?.email &&
    auth.token?.email_verified === true &&
    ADMIN_EMAILS.has(auth.token.email as string)
  ) {
    try {
      await db.collection("admins").doc(auth.uid).set(
        {
          uid: auth.uid,
          email: auth.token.email,
          role: "super_admin",
          bootstrapped_at: new Date().toISOString(),
        },
        { merge: true },
      );
    } catch (err) {
      logger.warn("Could not auto-bootstrap admin document for verified admin email:", err);
    }
    return true;
  }
  return false;
}

/**
 * Resolves and validates participant roles for swap requests.
 * Strictly guarantees that learner and teacher map only to the two participants
 * and preserves direction (normal or inverted).
 */
export function resolveSessionRoles(
  callerUid: string,
  partnerId: unknown,
  learnerId?: unknown,
  teacherId?: unknown,
): { learnerId: string; teacherId: string } {
  if (!partnerId || typeof partnerId !== "string" || !partnerId.trim()) {
    throw new HttpsError("invalid-argument", "Hamkor (partnerId) tanlanishi shart.");
  }
  if (partnerId === callerUid) {
    throw new HttpsError("invalid-argument", "O‘zingizga o‘zingiz so‘rov yubora olmaysiz.");
  }

  let finalLearnerId = callerUid;
  let finalTeacherId = partnerId;

  if (learnerId !== undefined || teacherId !== undefined) {
    const validNormal = learnerId === callerUid && teacherId === partnerId;
    const validInverted = learnerId === partnerId && teacherId === callerUid;
    if (validNormal) {
      finalLearnerId = callerUid;
      finalTeacherId = partnerId;
    } else if (validInverted) {
      finalLearnerId = partnerId;
      finalTeacherId = callerUid;
    } else {
      throw new HttpsError(
        "invalid-argument",
        "O‘quvchi va o‘qituvchi faqat dars ishtirokchilari (so‘rov yuboruvchi va hamkor) bo‘lishi shart.",
      );
    }
  }

  return { learnerId: finalLearnerId, teacherId: finalTeacherId };
}

/**
 * Validates session lifecycle status and participant role integrity for settlement.
 * Enforces status prerequisites (must be 'accepted', cannot be pending, cancelled, or disputed),
 * and verifies learner and teacher match the legitimate participants.
 */
export function validateSessionForSettlement(session: Record<string, unknown>): {
  learnerId: string;
  teacherId: string;
  reqId: string;
  partId: string;
} {
  // Status validation: cannot settle pending, cancelled, or disputed sessions
  if (session.status === "pending") {
    throw new HttpsError(
      "failed-precondition",
      "Kutilayotgan (pending) dars so‘rovi bo‘yicha davomat tasdiqlab bo‘lmaydi. Avval hamkor so‘rovni qabul qilishi shart.",
    );
  }
  if (session.status === "cancelled") {
    throw new HttpsError(
      "failed-precondition",
      "Bekor qilingan dars bo‘yicha davomat tasdiqlab bo‘lmaydi.",
    );
  }
  if (session.status === "disputed" || session.no_show === true) {
    throw new HttpsError(
      "failed-precondition",
      "Nizoli yoki no-show belgilangan dars bo‘yicha hisob-kitob qilib bo‘lmaydi.",
    );
  }
  if (session.status !== "accepted") {
    throw new HttpsError(
      "failed-precondition",
      `Faqat qabul qilingan (accepted) mashg‘ulotlar bo‘yicha hisob-kitob qilish mumkin (Joriy holat: ${session.status || "noma'lum"}).`,
    );
  }

  const reqId = session.requester_id;
  const partId = session.partner_id;

  if (
    !reqId ||
    !partId ||
    typeof reqId !== "string" ||
    typeof partId !== "string" ||
    reqId === partId
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Sessiya ishtirokchilari identifikatori noto‘g‘ri yoki to‘liq emas.",
    );
  }

  // Preserve intended lesson direction:
  let learnerId = session.learner_id;
  let teacherId = session.teacher_id;

  if (!learnerId || !teacherId) {
    learnerId = learnerId || reqId;
    teacherId = teacherId || partId;
  }

  if (typeof learnerId !== "string" || typeof teacherId !== "string" || learnerId === teacherId) {
    throw new HttpsError(
      "invalid-argument",
      "Sessiyada o‘quvchi yoki o‘qituvchi identifikatori noto‘g‘ri.",
    );
  }

  // Strictly enforce that learner and teacher must map exactly to the two legitimate participants
  const isNormalDirection = learnerId === reqId && teacherId === partId;
  const isInvertedDirection = learnerId === partId && teacherId === reqId;

  if (!isNormalDirection && !isInvertedDirection) {
    throw new HttpsError(
      "invalid-argument",
      "O‘quvchi va o‘qituvchi ushbu darsning haqiqiy ishtirokchilariga mos kelishi shart.",
    );
  }

  return { learnerId, teacherId, reqId, partId };
}

/**
 * Helper to execute session confirmation and atomic completion transaction.
 * Deducts 1 PeerPoint from the learner, adds 1 to the teacher, sets status to 'completed'.
 * Strictly idempotent: will never deduct/add twice.
 * Concurrency-safe: simultaneous participant confirmations execute within the Firestore transaction,
 * ensuring no fully confirmed session is left permanently unsettled.
 */
export async function executeSessionSettlementTransaction(
  db: ReturnType<typeof getDb>,
  sessionId: string,
  callerUid?: string,
  options?: {
    confirmCallerAttendance?: boolean;
  },
) {
  const sessionRef = db.collection("swap_sessions").doc(sessionId);

  return db.runTransaction(async (transaction) => {
    const sessionSnap = await transaction.get(sessionRef);
    if (!sessionSnap.exists) {
      throw new HttpsError("not-found", `Sessiya topilmadi (ID: ${sessionId})`);
    }

    const session = sessionSnap.data() || {};
    const nowIso = new Date().toISOString();

    // 1. Idempotency Check: if already completed or settled, return immediately without duplicate transfer
    if (session.status === "completed" || session.is_settled === true) {
      return {
        success: true,
        alreadyCompleted: true,
        bothConfirmed: true,
        settled: true,
        message: "Sessiya allaqachon muvaffaqiyatli yakunlangan va ballar o‘tkazilgan.",
        status: "completed",
      };
    }

    // Status validation & participant role integrity check
    const { learnerId, teacherId } = validateSessionForSettlement(session);

    const isRequester = callerUid ? session.requester_id === callerUid : false;
    const isPartner = callerUid ? session.partner_id === callerUid : false;

    // Only actual participants may confirm attendance
    if (options?.confirmCallerAttendance) {
      if (!isRequester && !isPartner) {
        throw new HttpsError(
          "permission-denied",
          "Faqat mashg‘ulotning haqiqiy ishtirokchilari davomatni tasdiqlashi mumkin.",
        );
      }
    }

    // Determine current confirmation status
    const reqConfirmed =
      options?.confirmCallerAttendance && isRequester ? true : session.requester_confirmed === true;
    const partConfirmed =
      options?.confirmCallerAttendance && isPartner ? true : session.partner_confirmed === true;

    // If not both confirmed yet, update caller's confirmation flag or fail completeSession
    if (!reqConfirmed || !partConfirmed) {
      if (options?.confirmCallerAttendance) {
        const updates: Record<string, unknown> = {
          updated_at: nowIso,
        };
        if (isRequester) {
          updates.requester_confirmed = true;
          updates.requester_confirmed_at = nowIso;
        } else if (isPartner) {
          updates.partner_confirmed = true;
          updates.partner_confirmed_at = nowIso;
        }
        transaction.update(sessionRef, updates);

        return {
          success: true,
          alreadyCompleted: false,
          bothConfirmed: false,
          settled: false,
          message:
            "Ishtirokingiz tasdiqlandi. Hamkor ham tasdiqlaganidan so‘ng PeerPointlar adolatli o‘tkaziladi.",
        };
      } else {
        // Direct completeSession call before dual confirmation
        throw new HttpsError(
          "failed-precondition",
          "Dars hali ikkala ishtirokchi tomonidan to‘liq tasdiqlanmagan. Hisob-kitob amalga oshirilmadi.",
        );
      }
    }

    // 2. Both participants have confirmed! Proceed to atomic settlement
    const learnerRef = db.collection("profiles").doc(learnerId);
    const teacherRef = db.collection("profiles").doc(teacherId);

    const [learnerSnap, teacherSnap] = await Promise.all([
      transaction.get(learnerRef),
      transaction.get(teacherRef),
    ]);

    if (!learnerSnap.exists) {
      throw new HttpsError("not-found", `O‘quvchi profili topilmadi (ID: ${learnerId})`);
    }
    if (!teacherSnap.exists) {
      throw new HttpsError("not-found", `O‘qituvchi profili topilmadi (ID: ${teacherId})`);
    }

    const learnerData = learnerSnap.data() || {};
    const teacherData = teacherSnap.data() || {};

    const learnerCoins = typeof learnerData.peercoins === "number" ? learnerData.peercoins : 0;
    const teacherCoins = typeof teacherData.peercoins === "number" ? teacherData.peercoins : 0;

    // 3. Reject if learner has 0 points
    if (learnerCoins <= 0) {
      throw new HttpsError(
        "failed-precondition",
        "O‘quvchining balansi yetarli emas (0 PeerPoint). Darsni yakunlash uchun ball xarid qilish yoki o‘rgatish orqali ball to‘plash zarur.",
      );
    }

    // 4. Atomic transaction mutations
    transaction.update(learnerRef, {
      peercoins: learnerCoins - 1,
      updated_at: nowIso,
    });

    transaction.update(teacherRef, {
      peercoins: teacherCoins + 1,
      updated_at: nowIso,
    });

    const sessionUpdates: Record<string, unknown> = {
      status: "completed",
      completed_at: nowIso,
      is_settled: true,
      settled_at: nowIso,
      points_transferred: 1,
      requester_confirmed: true,
      partner_confirmed: true,
      updated_at: nowIso,
    };

    if (options?.confirmCallerAttendance) {
      if (isRequester && !session.requester_confirmed) {
        sessionUpdates.requester_confirmed_at = nowIso;
      }
      if (isPartner && !session.partner_confirmed) {
        sessionUpdates.partner_confirmed_at = nowIso;
      }
    }

    transaction.update(sessionRef, sessionUpdates);

    // 5. Append ledger entry for audit trail
    const txRef = db.collection("point_transactions").doc();
    transaction.set(txRef, {
      id: txRef.id,
      session_id: sessionId,
      learner_id: learnerId,
      teacher_id: teacherId,
      points: 1,
      initiated_by: callerUid || "system",
      created_at: nowIso,
    });

    return {
      success: true,
      alreadyCompleted: false,
      bothConfirmed: true,
      settled: true,
      message:
        "Mashg‘ulot muvaffaqiyatli yakunlandi: O‘quvchidan 1 PeerPoint yechildi va O‘qituvchiga 1 PeerPoint o‘tkazildi.",
      status: "completed",
      learnerBalance: learnerCoins - 1,
      teacherBalance: teacherCoins + 1,
    };
  });
}

/**
 * 1. completeSession(sessionId): callable
 * Verifies both participants confirmed, runs Firestore transaction:
 * deducts 1 PeerPoint from learner, adds 1 to teacher, sets status "completed" and completed_at.
 * Idempotent (never pays twice), rejects if learner has 0 points.
 */
export const completeSession = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Foydalanuvchi tizimga kirmagan.");
  }

  const { sessionId } = request.data || {};
  if (!sessionId || typeof sessionId !== "string") {
    throw new HttpsError("invalid-argument", "sessionId ko‘rsatilishi shart.");
  }

  const db = getDb();
  const sessionDoc = await db.collection("swap_sessions").doc(sessionId).get();
  if (!sessionDoc.exists) {
    throw new HttpsError("not-found", "Bunday mashg‘ulot topilmadi.");
  }

  const data = sessionDoc.data() || {};
  const callerUid = request.auth.uid;

  // Caller must be one of the participants or an admin
  const isParticipant = data.requester_id === callerUid || data.partner_id === callerUid;
  const isAdmin = await isCallerAdmin(request.auth, db);

  if (!isParticipant && !isAdmin) {
    throw new HttpsError("permission-denied", "Siz ushbu mashg‘ulot ishtirokchisi emassiz.");
  }

  return executeSessionSettlementTransaction(db, sessionId, callerUid);
});

/**
 * 2. Weekly limits: free = 3 lessons/week, premium = 15 PeerPoints/week, pro = unlimited.
 * Enforces atomic quota increment and strict participant role validation.
 */
export const createSwapRequest = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirishingiz lozim.");
  }

  const callerUid = request.auth.uid;
  const { partnerId, requesterTeaches, partnerTeaches, learnerId, teacherId } = request.data || {};

  if (!partnerId || typeof partnerId !== "string" || !partnerId.trim()) {
    throw new HttpsError("invalid-argument", "Hamkor (partnerId) tanlanishi shart.");
  }

  if (partnerId === callerUid) {
    throw new HttpsError("invalid-argument", "O‘zingizga o‘zingiz so‘rov yubora olmaysiz.");
  }

  const db = getDb();
  const callerRef = db.collection("profiles").doc(callerUid);
  const partnerRef = db.collection("profiles").doc(partnerId);

  return db.runTransaction(async (transaction) => {
    const [callerSnap, partnerSnap] = await Promise.all([
      transaction.get(callerRef),
      transaction.get(partnerRef),
    ]);

    if (!callerSnap.exists) {
      throw new HttpsError("not-found", "Foydalanuvchi profili topilmadi.");
    }
    if (!partnerSnap.exists) {
      throw new HttpsError("not-found", "Hamkor profili topilmadi.");
    }

    const profile = callerSnap.data() || {};
    const plan = (profile.plan || "free") as "free" | "premium" | "pro";
    const limit = PLAN_LIMITS[plan] ?? 3;
    const currentUsed =
      typeof profile.weekly_lessons_used === "number"
        ? profile.weekly_lessons_used
        : typeof profile.weekly_points_used === "number"
          ? profile.weekly_points_used
          : 0;

    // Check weekly quota
    if (currentUsed >= limit) {
      let msg = "";
      if (plan === "free") {
        msg = `Free rejangiz bo‘yicha haftalik limitga (3 ta dars/hafta) yetdingiz. Ko‘proq almashinuvlar uchun Premium (15 ta) yoki Pro (cheksiz) tarifiga o‘ting.`;
      } else if (plan === "premium") {
        msg = `Premium rejangiz bo‘yicha haftalik limitga (15 ta PeerPoint/hafta) yetdingiz. Cheksiz darslar uchun Pro rejasiga obuna bo‘ling.`;
      } else {
        msg = `Haftalik limit tugadi.`;
      }
      throw new HttpsError("resource-exhausted", msg);
    }

    // Role mapping: strictly enforce that learner and teacher can ONLY be callerUid and partnerId
    const { learnerId: finalLearnerId, teacherId: finalTeacherId } = resolveSessionRoles(
      callerUid,
      partnerId,
      learnerId,
      teacherId,
    );

    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const sessionRef = db.collection("swap_sessions").doc(sessionId);
    const nowIso = new Date().toISOString();

    // Increment weekly quota
    transaction.update(callerRef, {
      weekly_lessons_used: currentUsed + 1,
      weekly_points_used: currentUsed + 1,
      updated_at: nowIso,
    });

    // Create new session
    transaction.set(sessionRef, {
      id: sessionId,
      requester_id: callerUid,
      partner_id: partnerId,
      requester_teaches: requesterTeaches || "Kelishiladi",
      partner_teaches: partnerTeaches || "Kelishiladi",
      learner_id: finalLearnerId,
      teacher_id: finalTeacherId,
      status: "pending",
      requester_confirmed: false,
      partner_confirmed: false,
      created_at: nowIso,
      completed_at: null,
      is_settled: false,
      points_transferred: 0,
    });

    return {
      success: true,
      sessionId,
      plan,
      weeklyLessonsUsed: currentUsed + 1,
      remaining: limit === Infinity ? null : Math.max(0, limit - (currentUsed + 1)),
      message: "Almashinuv so‘rovi muvaffaqiyatli yuborildi.",
    };
  });
});

/**
 * Attendance and Confirmation Handler
 * Handles both participant attendance confirmation and No-Show abuse handling.
 * Concurrency-safe: atomically executes confirmation and settlement.
 */
export const confirmSessionAttendance = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirishingiz lozim.");
  }

  const callerUid = request.auth.uid;
  const { sessionId, didAttend, isNoShow, reason } = request.data || {};

  if (!sessionId || typeof sessionId !== "string") {
    throw new HttpsError("invalid-argument", "sessionId kiritilishi shart.");
  }

  const db = getDb();
  const sessionRef = db.collection("swap_sessions").doc(sessionId);
  const nowIso = new Date().toISOString();

  // 3. Abuse handling: "no-show" option in the session flow
  if (didAttend === false || isNoShow === true) {
    const reportData = await db.runTransaction(async (transaction) => {
      const sessionSnap = await transaction.get(sessionRef);
      if (!sessionSnap.exists) {
        throw new HttpsError("not-found", "Sessiya topilmadi.");
      }
      const session = sessionSnap.data() || {};
      const isRequester = session.requester_id === callerUid;
      const isPartner = session.partner_id === callerUid;

      if (!isRequester && !isPartner) {
        throw new HttpsError(
          "permission-denied",
          "Faqat mashg‘ulotning haqiqiy ishtirokchilari no-show xabar qilishi mumkin.",
        );
      }

      // Cannot report no-show on completed or settled sessions
      if (session.status === "completed" || session.is_settled === true) {
        throw new HttpsError(
          "failed-precondition",
          "Yakunlangan yoki hisob-kitob qilingan sessiya bo‘yicha no-show e’lon qilib bo‘lmaydi.",
        );
      }

      // Cannot report no-show on cancelled sessions
      if (session.status === "cancelled") {
        throw new HttpsError(
          "failed-precondition",
          "Bekor qilingan dars bo‘yicha no-show xabar qilib bo‘lmaydi.",
        );
      }

      // Cannot report no-show on pending sessions (not yet accepted)
      if (session.status === "pending") {
        throw new HttpsError(
          "failed-precondition",
          "Kutilayotgan (pending) so‘rov bo‘yicha no-show e’lon qilib bo‘lmaydi. Avval hamkor darsni qabul qilishi shart.",
        );
      }

      // Idempotency: if already disputed, return gracefully
      if (session.status === "disputed" && session.no_show === true) {
        return {
          alreadyDisputed: true,
          partnerId: isRequester ? session.partner_id : session.requester_id,
        };
      }

      const partnerId = isRequester ? session.partner_id : session.requester_id;
      const reportId = `rep_noshow_${sessionId}_${callerUid}`;
      const reportRef = db.collection("reports").doc(reportId);

      transaction.update(sessionRef, {
        status: "disputed",
        no_show: true,
        no_show_reported_by: callerUid,
        no_show_reason: reason || "Hamkor mashg‘ulotga kelmadi (No-show)",
        no_show_at: nowIso,
        updated_at: nowIso,
      });

      // Atomically create the audit report document inside the same transaction
      transaction.set(
        reportRef,
        {
          id: reportId,
          reporter_id: callerUid,
          reported_user_id: partnerId,
          session_id: sessionId,
          reason: "no_show",
          details: reason || "Hamkor darsga qatnashmadi (No-show).",
          status: "pending",
          created_at: nowIso,
        },
        { merge: true },
      );

      return {
        alreadyDisputed: false,
        partnerId,
      };
    });

    return {
      success: true,
      noShowRecorded: !reportData.alreadyDisputed,
      alreadyDisputed: reportData.alreadyDisputed,
      status: "disputed",
      message: reportData.alreadyDisputed
        ? "No-show allaqachon belgilangan."
        : "No-show belgilandi. Balansingizdan hech qanday PeerPoint yechilmadi va ma’muriyatga xabar qilindi.",
    };
  }

  // Attendance confirmation (didAttend !== false)
  return executeSessionSettlementTransaction(db, sessionId, callerUid, {
    confirmCallerAttendance: true,
  });
});

/**
 * 3. Abuse handling: Report user callable
 * Writes to "reports" collection (which has admin-only read in firestore.rules)
 */
export const reportUser = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirishingiz lozim.");
  }

  const callerUid = request.auth.uid;
  const { reportedUserId, sessionId, reason, details } = request.data || {};

  if (!reportedUserId || typeof reportedUserId !== "string") {
    throw new HttpsError("invalid-argument", "Shikoyat qilinayotgan foydalanuvchi ko‘rsatilmagan.");
  }

  if (reportedUserId === callerUid) {
    throw new HttpsError("invalid-argument", "O‘zingizning ustingizdan shikoyat qila olmaysiz.");
  }

  const db = getDb();
  const reportId = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const nowIso = new Date().toISOString();

  await db
    .collection("reports")
    .doc(reportId)
    .set({
      id: reportId,
      reporter_id: callerUid,
      reported_user_id: reportedUserId,
      session_id: sessionId || null,
      reason: reason || "inappropriate_behavior",
      details: details ? String(details).slice(0, 1000) : "Tafsilot ko‘rsatilmadi",
      status: "pending",
      created_at: nowIso,
    });

  return {
    success: true,
    reportId,
    message: "Shikoyatingiz qabul qilindi. Ma’murlar tez orada ko‘rib chiqadi.",
  };
});

/**
 * 2. Scheduled weeklyReset (Monday 00:00 Asia/Tashkent).
 * Resets weekly_lessons_used and weekly_points_used to 0 for all users.
 */
export const weeklyReset = onSchedule(
  {
    schedule: "0 0 * * 1",
    timeZone: "Asia/Tashkent",
  },
  async () => {
    logger.info("Executing scheduled weeklyReset for Asia/Tashkent (Monday 00:00)...");
    const db = getDb();
    const profilesSnap = await db.collection("profiles").get();

    if (profilesSnap.empty) {
      logger.info("No profiles to reset.");
      return;
    }

    const nowIso = new Date().toISOString();
    let batch = db.batch();
    let count = 0;
    let totalUpdated = 0;

    for (const docSnap of profilesSnap.docs) {
      batch.update(docSnap.ref, {
        weekly_lessons_used: 0,
        weekly_points_used: 0,
        week_start: nowIso,
        updated_at: nowIso,
      });
      count++;
      totalUpdated++;

      if (count === 400) {
        await batch.commit();
        batch = db.batch();
        count = 0;
      }
    }

    if (count > 0) {
      await batch.commit();
    }

    logger.info(`weeklyReset completed. Successfully reset ${totalUpdated} user profiles.`);
  },
);

/**
 * 3. Scheduled function that auto-resolves single-sided confirmations after 48h
 * by flagging "needs_review" for admin.
 */
export const autoResolveStaleSessions = onSchedule(
  {
    schedule: "0 */2 * * *", // every 2 hours
    timeZone: "Asia/Tashkent",
  },
  async () => {
    logger.info("Checking for single-sided confirmations older than 48 hours...");
    const db = getDb();

    // Find active sessions that are accepted or pending completion
    const sessionsSnap = await db
      .collection("swap_sessions")
      .where("status", "in", ["accepted"])
      .get();

    if (sessionsSnap.empty) {
      logger.info("No active sessions to evaluate.");
      return;
    }

    const now = Date.now();
    const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
    let flaggedCount = 0;

    for (const docSnap of sessionsSnap.docs) {
      const data = docSnap.data();
      const reqConf = data.requester_confirmed === true;
      const partConf = data.partner_confirmed === true;

      // Check single-sided confirmation
      const isSingleSided = (reqConf && !partConf) || (partConf && !reqConf);
      if (!isSingleSided) continue;

      const confirmedTimeStr = reqConf ? data.requester_confirmed_at : data.partner_confirmed_at;
      const confirmedTime = confirmedTimeStr ? new Date(confirmedTimeStr).getTime() : 0;

      if (confirmedTime > 0 && now - confirmedTime >= FORTY_EIGHT_HOURS_MS) {
        // Flag for admin review
        await docSnap.ref.update({
          status: "needs_review",
          review_reason:
            "Single-sided confirmation exceeded 48 hours without confirmation from partner",
          flagged_for_admin: true,
          flagged_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        // Also create an admin task / report item
        const reportId = `autoflag_${docSnap.id}`;
        await db
          .collection("reports")
          .doc(reportId)
          .set(
            {
              id: reportId,
              reporter_id: "system",
              reported_user_id: reqConf ? data.partner_id : data.requester_id,
              session_id: docSnap.id,
              reason: "unresponsive_partner_48h",
              details: `Foydalanuvchilardan biri darsni tasdiqlagan, biroq ikkinchi tomon 48 soat davomida javob bermadi. Ma’muriyat tekshiruvi zarur.`,
              status: "pending",
              created_at: new Date().toISOString(),
            },
            { merge: true },
          );

        flaggedCount++;
      }
    }

    logger.info(`autoResolveStaleSessions completed. Flagged ${flaggedCount} stale sessions.`);
  },
);

/**
 * Subscription Plan Upgrade Request Handler
 * Safely records a pending plan upgrade request without self-granting paid tiers.
 * Paid plans require verified payment gateway processing (Click / Payme) or admin authorization.
 */
export const requestSubscriptionUpgrade = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirishingiz lozim.");
  }

  const callerUid = request.auth.uid;
  const callerEmail = request.auth.token?.email || "";
  const { plan } = request.data || {};

  if (plan !== "premium" && plan !== "pro") {
    throw new HttpsError(
      "invalid-argument",
      "Faqat Premium yoki Pro tariflari uchun yangilanish so‘rovi yuborish mumkin.",
    );
  }

  const db = getDb();
  const requestId = `subreq_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const nowIso = new Date().toISOString();

  await db.collection("subscription_requests").doc(requestId).set({
    id: requestId,
    user_id: callerUid,
    user_email: callerEmail,
    target_plan: plan,
    status: "pending_payment",
    created_at: nowIso,
    note: "Awaiting payment gateway integration (Click/Payme). Plan not activated.",
  });

  return {
    success: true,
    status: "pending_payment",
    targetPlan: plan,
    message:
      "To‘lov tizimlari (Click / Payme) integratsiyasi jarayonda. Qiziqishingiz qayd etildi, pullik xizmatlar rasman ochilgach sizga xabar beramiz.",
  };
});

/**
 * Cancel Paid Subscription (Downgrade to Free)
 * Allows a paid user (premium or pro) to safely downgrade to the free tier.
 * Cannot be used by clients to upgrade to paid tiers.
 */
export const cancelSubscription = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirishingiz lozim.");
  }

  const callerUid = request.auth.uid;
  const db = getDb();
  const profileRef = db.collection("profiles").doc(callerUid);
  const snap = await profileRef.get();

  if (!snap.exists) {
    throw new HttpsError("not-found", "Foydalanuvchi profili topilmadi.");
  }

  const nowIso = new Date().toISOString();
  await profileRef.update({
    plan: "free",
    updated_at: nowIso,
  });

  return {
    success: true,
    plan: "free",
    message: "Tarifingiz Bepul (Free) rejasiga muvaffaqiyatli o‘tkazildi.",
  };
});

/**
 * Admin: Update User Plan
 * Strictly requires admin authorization.
 */
export const adminSetUserPlan = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirishingiz lozim.");
  }

  const callerUid = request.auth.uid;
  const db = getDb();

  const isAdmin = await isCallerAdmin(request.auth, db);

  if (!isAdmin) {
    throw new HttpsError("permission-denied", "Ushbu amalni faqat administrator bajara oladi.");
  }

  const { targetUserId, plan } = request.data || {};
  if (!targetUserId || typeof targetUserId !== "string") {
    throw new HttpsError("invalid-argument", "Foydalanuvchi ID kiritilishi shart.");
  }

  if (plan !== "free" && plan !== "premium" && plan !== "pro") {
    throw new HttpsError("invalid-argument", "Noto‘g‘ri tarif turi ko‘rsatildi.");
  }

  const targetRef = db.collection("profiles").doc(targetUserId);
  const snap = await targetRef.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Foydalanuvchi topilmadi.");
  }

  const nowIso = new Date().toISOString();
  await targetRef.update({
    plan,
    updated_at: nowIso,
  });

  return {
    success: true,
    userId: targetUserId,
    plan,
    message: `Foydalanuvchi tarifi ${plan.toUpperCase()} ga muvaffaqiyatli o‘zgartirildi.`,
  };
});
