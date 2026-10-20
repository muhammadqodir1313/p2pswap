"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminSetUserPlan =
  exports.cancelSubscription =
  exports.requestSubscriptionUpgrade =
  exports.autoResolveStaleSessions =
  exports.weeklyReset =
  exports.reportUser =
  exports.confirmSessionAttendance =
  exports.createSwapRequest =
  exports.completeSession =
  exports.PLAN_LIMITS =
    void 0;
exports.getDb = getDb;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firebase_functions_1 = require("firebase-functions");
const app = (0, app_1.initializeApp)();
// Target project database id
const databaseId =
  process.env.FIRESTORE_DATABASE_ID || "ai-studio-p2pswap-dd0d3ce1-74df-4783-ac3d-28766ee593b1";
function getDb() {
  try {
    return (0, firestore_1.getFirestore)(app, databaseId);
  } catch {
    return (0, firestore_1.getFirestore)(app);
  }
}
// Plan weekly limits
exports.PLAN_LIMITS = {
  free: 3,
  premium: 15,
  pro: Infinity,
};
/**
 * Helper to execute the session completion transaction.
 * Deducts 1 PeerPoint from the learner, adds 1 to the teacher, sets status to 'completed'.
 * Strictly idempotent: will never deduct/add twice.
 */
async function executeSessionSettlementTransaction(db, sessionId, callerUid) {
  const sessionRef = db.collection("swap_sessions").doc(sessionId);
  return db.runTransaction(async (transaction) => {
    const sessionSnap = await transaction.get(sessionRef);
    if (!sessionSnap.exists) {
      throw new https_1.HttpsError("not-found", `Sessiya topilmadi (ID: ${sessionId})`);
    }
    const session = sessionSnap.data() || {};
    // 1. Idempotency Check: if already completed, return immediately without duplicate transfer
    if (session.status === "completed" || session.is_settled === true) {
      return {
        success: true,
        alreadyCompleted: true,
        message: "Sessiya allaqachon muvaffaqiyatli yakunlangan va ballar o‘tkazilgan.",
        status: "completed",
      };
    }
    // 2. Both participants must have confirmed
    const reqConfirmed = session.requester_confirmed === true;
    const partConfirmed = session.partner_confirmed === true;
    if (!reqConfirmed || !partConfirmed) {
      throw new https_1.HttpsError(
        "failed-precondition",
        "Ballarni o‘tkazish uchun ikkala ishtirokchi ham darsda qatnashganini tasdiqlashi shart.",
      );
    }
    // Determine learner and teacher
    // By default: requester requested the lesson, so requester is learner, partner is teacher.
    // If learner_id/teacher_id are explicitly recorded on session, use those.
    const learnerId = session.learner_id || session.requester_id;
    const teacherId = session.teacher_id || session.partner_id;
    if (!learnerId || !teacherId) {
      throw new https_1.HttpsError(
        "invalid-argument",
        "Sessiyada o‘quvchi yoki o‘qituvchi identifikatori ko‘rsatilmagan.",
      );
    }
    if (learnerId === teacherId) {
      throw new https_1.HttpsError(
        "invalid-argument",
        "O‘quvchi va o‘qituvchi bir xil foydalanuvchi bo‘lishi mumkin emas.",
      );
    }
    const learnerRef = db.collection("profiles").doc(learnerId);
    const teacherRef = db.collection("profiles").doc(teacherId);
    const [learnerSnap, teacherSnap] = await Promise.all([
      transaction.get(learnerRef),
      transaction.get(teacherRef),
    ]);
    if (!learnerSnap.exists) {
      throw new https_1.HttpsError("not-found", `O‘quvchi profili topilmadi (ID: ${learnerId})`);
    }
    if (!teacherSnap.exists) {
      throw new https_1.HttpsError("not-found", `O‘qituvchi profili topilmadi (ID: ${teacherId})`);
    }
    const learnerData = learnerSnap.data() || {};
    const teacherData = teacherSnap.data() || {};
    const learnerCoins = typeof learnerData.peercoins === "number" ? learnerData.peercoins : 0;
    const teacherCoins = typeof teacherData.peercoins === "number" ? teacherData.peercoins : 0;
    // 3. Reject if learner has 0 points
    if (learnerCoins <= 0) {
      throw new https_1.HttpsError(
        "failed-precondition",
        "O‘quvchining balansi yetarli emas (0 PeerPoint). Darsni yakunlash uchun ball xarid qilish yoki o‘rgatish orqali ball to‘plash zarur.",
      );
    }
    const nowIso = new Date().toISOString();
    // 4. Atomic transaction mutations
    transaction.update(learnerRef, {
      peercoins: learnerCoins - 1,
      updated_at: nowIso,
    });
    transaction.update(teacherRef, {
      peercoins: teacherCoins + 1,
      updated_at: nowIso,
    });
    transaction.update(sessionRef, {
      status: "completed",
      completed_at: nowIso,
      is_settled: true,
      settled_at: nowIso,
      points_transferred: 1,
      updated_at: nowIso,
    });
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
exports.completeSession = (0, https_1.onCall)({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new https_1.HttpsError("unauthenticated", "Foydalanuvchi tizimga kirmagan.");
  }
  const { sessionId } = request.data || {};
  if (!sessionId || typeof sessionId !== "string") {
    throw new https_1.HttpsError("invalid-argument", "sessionId ko‘rsatilishi shart.");
  }
  const db = getDb();
  const sessionDoc = await db.collection("swap_sessions").doc(sessionId).get();
  if (!sessionDoc.exists) {
    throw new https_1.HttpsError("not-found", "Bunday mashg‘ulot topilmadi.");
  }
  const data = sessionDoc.data() || {};
  const callerUid = request.auth.uid;
  // Caller must be one of the participants or an admin
  const isParticipant = data.requester_id === callerUid || data.partner_id === callerUid;
  const isAdmin = request.auth.token?.admin === true;
  if (!isParticipant && !isAdmin) {
    throw new https_1.HttpsError(
      "permission-denied",
      "Siz ushbu mashg‘ulot ishtirokchisi emassiz.",
    );
  }
  return executeSessionSettlementTransaction(db, sessionId, callerUid);
});
/**
 * 2. Weekly limits: free = 3 lessons/week, premium = 15 PeerPoints/week, pro = unlimited.
 * Enforce when a swap request is created and show a clear UI error.
 */
exports.createSwapRequest = (0, https_1.onCall)({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new https_1.HttpsError("unauthenticated", "Tizimga kirishingiz lozim.");
  }
  const callerUid = request.auth.uid;
  const { partnerId, requesterTeaches, partnerTeaches, learnerId, teacherId } = request.data || {};
  if (!partnerId || typeof partnerId !== "string") {
    throw new https_1.HttpsError("invalid-argument", "Hamkor (partnerId) tanlanishi shart.");
  }
  if (partnerId === callerUid) {
    throw new https_1.HttpsError("invalid-argument", "O‘zingizga o‘zingiz so‘rov yubora olmaysiz.");
  }
  const db = getDb();
  const callerRef = db.collection("profiles").doc(callerUid);
  return db.runTransaction(async (transaction) => {
    const callerSnap = await transaction.get(callerRef);
    if (!callerSnap.exists) {
      throw new https_1.HttpsError("not-found", "Foydalanuvchi profili topilmadi.");
    }
    const profile = callerSnap.data() || {};
    const plan = profile.plan || "free";
    const limit = exports.PLAN_LIMITS[plan] ?? 3;
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
      throw new https_1.HttpsError("resource-exhausted", msg);
    }
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
      learner_id: learnerId || callerUid,
      teacher_id: teacherId || partnerId,
      status: "pending",
      requester_confirmed: false,
      partner_confirmed: false,
      created_at: nowIso,
      completed_at: null,
      is_settled: false,
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
 */
exports.confirmSessionAttendance = (0, https_1.onCall)({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new https_1.HttpsError("unauthenticated", "Tizimga kirishingiz lozim.");
  }
  const callerUid = request.auth.uid;
  const { sessionId, didAttend, isNoShow, reason } = request.data || {};
  if (!sessionId) {
    throw new https_1.HttpsError("invalid-argument", "sessionId kiritilishi shart.");
  }
  const db = getDb();
  const sessionRef = db.collection("swap_sessions").doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) {
    throw new https_1.HttpsError("not-found", "Sessiya topilmadi.");
  }
  const session = sessionSnap.data() || {};
  const isRequester = session.requester_id === callerUid;
  const isPartner = session.partner_id === callerUid;
  const isAdmin = request.auth.token?.admin === true;
  if (!isRequester && !isPartner && !isAdmin) {
    throw new https_1.HttpsError("permission-denied", "Siz ushbu dars ishtirokchisi emassiz.");
  }
  const nowIso = new Date().toISOString();
  // 3. Abuse handling: "no-show" option in the session flow
  if (didAttend === false || isNoShow === true) {
    const partnerId = isRequester ? session.partner_id : session.requester_id;
    // Mark session as disputed/no_show, cancel point deduction
    await sessionRef.update({
      status: "disputed",
      no_show: true,
      no_show_reported_by: callerUid,
      no_show_reason: reason || "Hamkor mashg‘ulotga kelmadi (No-show)",
      no_show_at: nowIso,
      updated_at: nowIso,
    });
    // Automatically register a report in reports collection (admin-only read)
    const reportId = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await db
      .collection("reports")
      .doc(reportId)
      .set({
        id: reportId,
        reporter_id: callerUid,
        reported_user_id: partnerId,
        session_id: sessionId,
        reason: "no_show",
        details: reason || "Hamkor darsga qatnashmadi (No-show).",
        status: "pending",
        created_at: nowIso,
      });
    return {
      success: true,
      noShowRecorded: true,
      status: "disputed",
      message:
        "No-show belgilandi. Balansingizdan hech qanday PeerPoint yechilmadi va ma’muriyatga xabar qilindi.",
    };
  }
  // Mark current user as confirmed
  const updates = {
    updated_at: nowIso,
  };
  if (isRequester) {
    updates.requester_confirmed = true;
    updates.requester_confirmed_at = nowIso;
  } else {
    updates.partner_confirmed = true;
    updates.partner_confirmed_at = nowIso;
  }
  await sessionRef.update(updates);
  // Check if BOTH participants have confirmed
  const otherConfirmed = isRequester
    ? session.partner_confirmed === true
    : session.requester_confirmed === true;
  if (otherConfirmed) {
    // Both confirmed! Run the settlement transaction automatically
    const settlement = await executeSessionSettlementTransaction(db, sessionId, callerUid);
    return {
      bothConfirmed: true,
      settled: true,
      ...settlement,
    };
  }
  return {
    success: true,
    bothConfirmed: false,
    settled: false,
    message:
      "Ishtirokingiz tasdiqlandi. Hamkor ham tasdiqlaganidan so‘ng PeerPointlar adolatli o‘tkaziladi.",
  };
});
/**
 * 3. Abuse handling: Report user callable
 * Writes to "reports" collection (which has admin-only read in firestore.rules)
 */
exports.reportUser = (0, https_1.onCall)({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new https_1.HttpsError("unauthenticated", "Tizimga kirishingiz lozim.");
  }
  const callerUid = request.auth.uid;
  const { reportedUserId, sessionId, reason, details } = request.data || {};
  if (!reportedUserId || typeof reportedUserId !== "string") {
    throw new https_1.HttpsError(
      "invalid-argument",
      "Shikoyat qilinayotgan foydalanuvchi ko‘rsatilmagan.",
    );
  }
  if (reportedUserId === callerUid) {
    throw new https_1.HttpsError(
      "invalid-argument",
      "O‘zingizning ustingizdan shikoyat qila olmaysiz.",
    );
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
exports.weeklyReset = (0, scheduler_1.onSchedule)(
  {
    schedule: "0 0 * * 1",
    timeZone: "Asia/Tashkent",
  },
  async () => {
    firebase_functions_1.logger.info(
      "Executing scheduled weeklyReset for Asia/Tashkent (Monday 00:00)...",
    );
    const db = getDb();
    const profilesSnap = await db.collection("profiles").get();
    if (profilesSnap.empty) {
      firebase_functions_1.logger.info("No profiles to reset.");
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
    firebase_functions_1.logger.info(
      `weeklyReset completed. Successfully reset ${totalUpdated} user profiles.`,
    );
  },
);
/**
 * 3. Scheduled function that auto-resolves single-sided confirmations after 48h
 * by flagging "needs_review" for admin.
 */
exports.autoResolveStaleSessions = (0, scheduler_1.onSchedule)(
  {
    schedule: "0 */2 * * *", // every 2 hours
    timeZone: "Asia/Tashkent",
  },
  async () => {
    firebase_functions_1.logger.info(
      "Checking for single-sided confirmations older than 48 hours...",
    );
    const db = getDb();
    // Find active sessions that are accepted or pending completion
    const sessionsSnap = await db
      .collection("swap_sessions")
      .where("status", "in", ["accepted"])
      .get();
    if (sessionsSnap.empty) {
      firebase_functions_1.logger.info("No active sessions to evaluate.");
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
    firebase_functions_1.logger.info(
      `autoResolveStaleSessions completed. Flagged ${flaggedCount} stale sessions.`,
    );
  },
);
/**
 * Subscription Plan Upgrade Request Handler
 * Safely records a pending plan upgrade request without self-granting paid tiers.
 * Paid plans require verified payment gateway processing (Click / Payme) or admin authorization.
 */
exports.requestSubscriptionUpgrade = (0, https_1.onCall)({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new https_1.HttpsError("unauthenticated", "Tizimga kirishingiz lozim.");
  }
  const callerUid = request.auth.uid;
  const callerEmail = request.auth.token?.email || "";
  const { plan } = request.data || {};
  if (plan !== "premium" && plan !== "pro") {
    throw new https_1.HttpsError(
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
exports.cancelSubscription = (0, https_1.onCall)({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new https_1.HttpsError("unauthenticated", "Tizimga kirishingiz lozim.");
  }
  const callerUid = request.auth.uid;
  const db = getDb();
  const profileRef = db.collection("profiles").doc(callerUid);
  const snap = await profileRef.get();
  if (!snap.exists) {
    throw new https_1.HttpsError("not-found", "Foydalanuvchi profili topilmadi.");
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
exports.adminSetUserPlan = (0, https_1.onCall)({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new https_1.HttpsError("unauthenticated", "Tizimga kirishingiz lozim.");
  }
  const callerUid = request.auth.uid;
  const db = getDb();
  const isTokenAdmin = request.auth.token?.admin === true;
  const isEmailAdmin = request.auth.token?.email === "farhodjonovichm1301@gmail.com";
  let isAdmin = isTokenAdmin || isEmailAdmin;
  if (!isAdmin) {
    const adminDoc = await db.collection("admins").doc(callerUid).get();
    isAdmin = adminDoc.exists;
  }
  if (!isAdmin) {
    throw new https_1.HttpsError(
      "permission-denied",
      "Ushbu amalni faqat administrator bajara oladi.",
    );
  }
  const { targetUserId, plan } = request.data || {};
  if (!targetUserId || typeof targetUserId !== "string") {
    throw new https_1.HttpsError("invalid-argument", "Foydalanuvchi ID kiritilishi shart.");
  }
  if (plan !== "free" && plan !== "premium" && plan !== "pro") {
    throw new https_1.HttpsError("invalid-argument", "Noto‘g‘ri tarif turi ko‘rsatildi.");
  }
  const targetRef = db.collection("profiles").doc(targetUserId);
  const snap = await targetRef.get();
  if (!snap.exists) {
    throw new https_1.HttpsError("not-found", "Foydalanuvchi topilmadi.");
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
//# sourceMappingURL=index.js.map
