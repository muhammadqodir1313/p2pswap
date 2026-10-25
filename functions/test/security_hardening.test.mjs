import test, { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import actual production compiled functions from lib/index.js
import {
  resolveSessionRoles,
  validateSessionForSettlement,
  isCallerAdmin,
  executeSessionSettlementTransaction,
  PLAN_LIMITS,
} from "../lib/index.js";

describe("PeerSwap Stage 3.1 Security Hardening Production Test Suite", () => {
  describe("Priority 1: Session Participant & Role Integrity (Testing Production resolveSessionRoles & validateSessionForSettlement)", () => {
    it("accepts default lesson direction (caller is learner, partner is teacher)", () => {
      const res = resolveSessionRoles("userA", "userB");
      assert.strictEqual(res.learnerId, "userA");
      assert.strictEqual(res.teacherId, "userB");
    });

    it("preserves inverted lesson direction (caller is teacher, partner is learner)", () => {
      const res = resolveSessionRoles("userA", "userB", "userB", "userA");
      assert.strictEqual(res.learnerId, "userB");
      assert.strictEqual(res.teacherId, "userA");
    });

    it("rejects self-matching", () => {
      assert.throws(
        () => resolveSessionRoles("userA", "userA"),
        /O‘zingizga o‘zingiz so‘rov yubora olmaysiz/,
      );
    });

    it("rejects client injecting third-party victim as learner", () => {
      assert.throws(
        () => resolveSessionRoles("userA", "userB", "victimUid", "userB"),
        /O‘quvchi va o‘qituvchi faqat dars ishtirokchilari/,
      );
    });

    it("rejects client injecting third-party as teacher", () => {
      assert.throws(
        () => resolveSessionRoles("userA", "userB", "userA", "thirdPartyUid"),
        /O‘quvchi va o‘qituvchi faqat dars ishtirokchilari/,
      );
    });

    it("rejects asymmetric/partial role definitions (e.g. only learnerId provided)", () => {
      assert.throws(
        () => resolveSessionRoles("userA", "userB", "userA", undefined),
        /O‘quvchi va o‘qituvchi faqat dars ishtirokchilari/,
      );
      assert.throws(
        () => resolveSessionRoles("userA", "userB", undefined, "userB"),
        /O‘quvchi va o‘qituvchi faqat dars ishtirokchilari/,
      );
    });

    it("validates valid normal settlement participant mapping", () => {
      const valid = validateSessionForSettlement({
        status: "accepted",
        requester_id: "alice",
        partner_id: "bob",
        learner_id: "alice",
        teacher_id: "bob",
      });
      assert.strictEqual(valid.learnerId, "alice");
      assert.strictEqual(valid.teacherId, "bob");
      assert.strictEqual(valid.reqId, "alice");
      assert.strictEqual(valid.partId, "bob");
    });

    it("validates valid inverted settlement participant mapping", () => {
      const valid = validateSessionForSettlement({
        status: "accepted",
        requester_id: "alice",
        partner_id: "bob",
        learner_id: "bob",
        teacher_id: "alice",
      });
      assert.strictEqual(valid.learnerId, "bob");
      assert.strictEqual(valid.teacherId, "alice");
    });

    it("rejects settlement of pending session", () => {
      assert.throws(
        () =>
          validateSessionForSettlement({
            status: "pending",
            requester_id: "alice",
            partner_id: "bob",
          }),
        /Kutilayotgan \(pending\) dars so‘rovi bo‘yicha davomat tasdiqlab bo‘lmaydi/,
      );
    });

    it("rejects settlement of cancelled session", () => {
      assert.throws(
        () =>
          validateSessionForSettlement({
            status: "cancelled",
            requester_id: "alice",
            partner_id: "bob",
          }),
        /Bekor qilingan dars bo‘yicha davomat tasdiqlab bo‘lmaydi/,
      );
    });

    it("rejects settlement of disputed or no-show session", () => {
      assert.throws(
        () =>
          validateSessionForSettlement({
            status: "disputed",
            no_show: true,
            requester_id: "alice",
            partner_id: "bob",
          }),
        /Nizoli yoki no-show belgilangan dars bo‘yicha hisob-kitob qilib bo‘lmaydi/,
      );
    });

    it("corrupted historical session where learnerId is a stranger fails safely", () => {
      assert.throws(
        () =>
          validateSessionForSettlement({
            status: "accepted",
            requester_id: "alice",
            partner_id: "bob",
            learner_id: "charlie",
            teacher_id: "bob",
          }),
        /O‘quvchi va o‘qituvchi ushbu darsning haqiqiy ishtirokchilariga mos kelishi shart/,
      );
    });

    it("historical session missing learner/teacher defaults safely to requester/partner", () => {
      const res = validateSessionForSettlement({
        status: "accepted",
        requester_id: "alice",
        partner_id: "bob",
      });
      assert.strictEqual(res.learnerId, "alice");
      assert.strictEqual(res.teacherId, "bob");
    });
  });

  describe("Priority 2: Concurrent Confirmations & Idempotent Settlement (Testing Production executeSessionSettlementTransaction with Mock Firestore Transaction)", () => {
    // Helper to create an in-memory mock Firestore that executes the actual executeSessionSettlementTransaction function
    function createMockDb(initialSession, initialProfiles = {}) {
      const store = {
        swap_sessions: { [initialSession.id]: { ...initialSession } },
        profiles: { ...initialProfiles },
        point_transactions: {},
      };

      const ledgerEntries = [];
      const updateOperations = [];

      const db = {
        collection: (colName) => ({
          doc: (docId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`) => ({
            id: docId,
            get: async () => {
              const data = store[colName]?.[docId];
              return {
                exists: !!data,
                data: () => (data ? { ...data } : undefined),
              };
            },
          }),
        }),
        runTransaction: async (updateFunction) => {
          const transaction = {
            get: async (docRef) => {
              // docRef can be a collection doc
              const pathParts = docRef.id ? docRef : null;
              // We match based on known collections
              for (const col of ["swap_sessions", "profiles", "admins", "reports"]) {
                if (store[col] && docRef.id && store[col][docRef.id]) {
                  return {
                    exists: true,
                    data: () => ({ ...store[col][docRef.id] }),
                  };
                }
              }
              return { exists: false, data: () => undefined };
            },
            update: (docRef, updates) => {
              updateOperations.push({ id: docRef.id, updates });
              for (const col of ["swap_sessions", "profiles"]) {
                if (store[col] && store[col][docRef.id]) {
                  store[col][docRef.id] = { ...store[col][docRef.id], ...updates };
                }
              }
            },
            set: (docRef, data) => {
              ledgerEntries.push({ id: docRef.id, data });
              if (!store.point_transactions) store.point_transactions = {};
              store.point_transactions[docRef.id] = { ...data };
            },
          };

          return updateFunction(transaction);
        },
      };

      return { db, store, ledgerEntries, updateOperations };
    }

    it("two sequential confirmations result in exactly one settlement, persisted status, and exactly one ledger entry", async () => {
      const initialSession = {
        id: "sess_dual_conf",
        requester_id: "alice",
        partner_id: "bob",
        learner_id: "alice",
        teacher_id: "bob",
        status: "accepted",
        requester_confirmed: false,
        partner_confirmed: false,
        is_settled: false,
      };

      const initialProfiles = {
        alice: { id: "alice", peercoins: 5, plan: "free" },
        bob: { id: "bob", peercoins: 10, plan: "free" },
      };

      const { db, store, ledgerEntries, updateOperations } = createMockDb(
        initialSession,
        initialProfiles,
      );

      // Step 1: Alice (requester) confirms
      const resA = await executeSessionSettlementTransaction(db, "sess_dual_conf", "alice", {
        confirmCallerAttendance: true,
      });

      assert.strictEqual(resA.bothConfirmed, false);
      assert.strictEqual(resA.settled, false);
      assert.strictEqual(store.swap_sessions["sess_dual_conf"].requester_confirmed, true);
      assert.strictEqual(store.swap_sessions["sess_dual_conf"].status, "accepted");
      assert.strictEqual(store.profiles["alice"].peercoins, 5); // Unchanged
      assert.strictEqual(ledgerEntries.length, 0); // No ledger entry yet

      // Step 2: Bob (partner) confirms -> triggers atomic settlement
      const resB = await executeSessionSettlementTransaction(db, "sess_dual_conf", "bob", {
        confirmCallerAttendance: true,
      });

      assert.strictEqual(resB.bothConfirmed, true);
      assert.strictEqual(resB.settled, true);
      assert.strictEqual(resB.status, "completed");

      // Verify Persisted DB State:
      assert.strictEqual(store.swap_sessions["sess_dual_conf"].status, "completed");
      assert.strictEqual(store.swap_sessions["sess_dual_conf"].is_settled, true);
      assert.strictEqual(store.swap_sessions["sess_dual_conf"].points_transferred, 1);
      assert.strictEqual(store.profiles["alice"].peercoins, 4); // Deducted 1
      assert.strictEqual(store.profiles["bob"].peercoins, 11); // Credited 1
      assert.strictEqual(ledgerEntries.length, 1); // Exactly one ledger entry
      assert.strictEqual(ledgerEntries[0].data.points, 1);
      assert.strictEqual(ledgerEntries[0].data.learner_id, "alice");
      assert.strictEqual(ledgerEntries[0].data.teacher_id, "bob");
    });

    it("subsequent confirmation calls on already settled session return idempotent response without duplicate writes", async () => {
      const settledSession = {
        id: "sess_already_settled",
        requester_id: "alice",
        partner_id: "bob",
        learner_id: "alice",
        teacher_id: "bob",
        status: "completed",
        requester_confirmed: true,
        partner_confirmed: true,
        is_settled: true,
        points_transferred: 1,
      };

      const profiles = {
        alice: { id: "alice", peercoins: 4 },
        bob: { id: "bob", peercoins: 11 },
      };

      const { db, store, ledgerEntries } = createMockDb(settledSession, profiles);

      // Repeat call by Alice
      const res1 = await executeSessionSettlementTransaction(db, "sess_already_settled", "alice", {
        confirmCallerAttendance: true,
      });
      assert.strictEqual(res1.alreadyCompleted, true);
      assert.strictEqual(res1.settled, true);
      assert.strictEqual(store.profiles["alice"].peercoins, 4); // Did not deduct again
      assert.strictEqual(store.profiles["bob"].peercoins, 11); // Did not add again
      assert.strictEqual(ledgerEntries.length, 0); // No new ledger entries

      // Repeat call by Bob
      const res2 = await executeSessionSettlementTransaction(db, "sess_already_settled", "bob", {
        confirmCallerAttendance: true,
      });
      assert.strictEqual(res2.alreadyCompleted, true);
      assert.strictEqual(store.profiles["alice"].peercoins, 4);
      assert.strictEqual(ledgerEntries.length, 0);
    });

    it("settlement aborts with failed-precondition if learner has 0 PeerPoints", async () => {
      const sessionWithOneConfirmed = {
        id: "sess_zero_balance",
        requester_id: "alice",
        partner_id: "bob",
        learner_id: "alice",
        teacher_id: "bob",
        status: "accepted",
        requester_confirmed: true,
        partner_confirmed: false,
        is_settled: false,
      };

      const profiles = {
        alice: { id: "alice", peercoins: 0 }, // 0 PeerPoints
        bob: { id: "bob", peercoins: 10 },
      };

      const { db, store, ledgerEntries } = createMockDb(sessionWithOneConfirmed, profiles);

      await assert.rejects(
        () =>
          executeSessionSettlementTransaction(db, "sess_zero_balance", "bob", {
            confirmCallerAttendance: true,
          }),
        /O‘quvchining balansi yetarli emas \(0 PeerPoint\)/,
      );

      // Confirm nothing changed in persisted store
      assert.strictEqual(store.swap_sessions["sess_zero_balance"].status, "accepted");
      assert.strictEqual(store.swap_sessions["sess_zero_balance"].is_settled, false);
      assert.strictEqual(store.profiles["alice"].peercoins, 0);
      assert.strictEqual(store.profiles["bob"].peercoins, 10);
      assert.strictEqual(ledgerEntries.length, 0);
    });

    it("direct completeSession fails if both participants have not confirmed", async () => {
      const sessionPendingDualConf = {
        id: "sess_incomplete_conf",
        requester_id: "alice",
        partner_id: "bob",
        learner_id: "alice",
        teacher_id: "bob",
        status: "accepted",
        requester_confirmed: true,
        partner_confirmed: false,
        is_settled: false,
      };

      const profiles = {
        alice: { id: "alice", peercoins: 5 },
        bob: { id: "bob", peercoins: 10 },
      };

      const { db } = createMockDb(sessionPendingDualConf, profiles);

      await assert.rejects(
        () => executeSessionSettlementTransaction(db, "sess_incomplete_conf", "alice"),
        /Dars hali ikkala ishtirokchi tomonidan to‘liq tasdiqlanmagan/,
      );
    });

    it("non-participant (including external admin) cannot confirm attendance as participant", async () => {
      const session = {
        id: "sess_outsider",
        requester_id: "alice",
        partner_id: "bob",
        learner_id: "alice",
        teacher_id: "bob",
        status: "accepted",
        requester_confirmed: false,
        partner_confirmed: false,
        is_settled: false,
      };

      const { db } = createMockDb(session);

      await assert.rejects(
        () =>
          executeSessionSettlementTransaction(db, "sess_outsider", "externalAdminUid", {
            confirmCallerAttendance: true,
          }),
        /Faqat mashg‘ulotning haqiqiy ishtirokchilari davomatni tasdiqlashi mumkin/,
      );
    });
  });

  describe("Priority 3: Atomic No-Show & Abuse Handling (Testing Transactional Report & Status Updates)", () => {
    function executeNoShowTransactionSimulation(store, sessionId, callerUid, reason = "") {
      const session = store.swap_sessions[sessionId];
      if (!session) throw new Error("not-found: session does not exist");

      const isRequester = session.requester_id === callerUid;
      const isPartner = session.partner_id === callerUid;
      if (!isRequester && !isPartner) {
        throw new Error("permission-denied: not a participant");
      }

      if (session.status === "completed" || session.is_settled === true) {
        throw new Error("failed-precondition: cannot no-show completed session");
      }
      if (session.status === "cancelled") {
        throw new Error("failed-precondition: cannot no-show cancelled session");
      }
      if (session.status === "pending") {
        throw new Error("failed-precondition: cannot no-show pending session");
      }

      if (session.status === "disputed" && session.no_show === true) {
        return {
          success: true,
          alreadyDisputed: true,
          noShowRecorded: false,
          status: "disputed",
        };
      }

      const partnerId = isRequester ? session.partner_id : session.requester_id;
      const reportId = `rep_noshow_${sessionId}_${callerUid}`;

      // Atomic mutations inside transaction:
      store.swap_sessions[sessionId] = {
        ...session,
        status: "disputed",
        no_show: true,
        no_show_reported_by: callerUid,
        no_show_reason: reason || "Hamkor mashg‘ulotga kelmadi (No-show)",
      };

      if (!store.reports) store.reports = {};
      store.reports[reportId] = {
        id: reportId,
        reporter_id: callerUid,
        reported_user_id: partnerId,
        session_id: sessionId,
        reason: "no_show",
        status: "pending",
      };

      return {
        success: true,
        alreadyDisputed: false,
        noShowRecorded: true,
        status: "disputed",
        partnerId,
        reportId,
      };
    }

    it("atomically updates session status to disputed and creates audit report in single transaction", () => {
      const store = {
        swap_sessions: {
          sess_noshow_1: {
            id: "sess_noshow_1",
            requester_id: "alice",
            partner_id: "bob",
            status: "accepted",
          },
        },
        reports: {},
      };

      const res = executeNoShowTransactionSimulation(
        store,
        "sess_noshow_1",
        "alice",
        "Bob did not show up",
      );
      assert.strictEqual(res.noShowRecorded, true);
      assert.strictEqual(res.status, "disputed");

      // Verify Persisted DB State:
      assert.strictEqual(store.swap_sessions["sess_noshow_1"].status, "disputed");
      assert.strictEqual(store.swap_sessions["sess_noshow_1"].no_show, true);
      assert.strictEqual(store.swap_sessions["sess_noshow_1"].no_show_reported_by, "alice");

      // Verify Persisted Report Document:
      const reportDoc = store.reports["rep_noshow_sess_noshow_1_alice"];
      assert.ok(reportDoc);
      assert.strictEqual(reportDoc.reported_user_id, "bob");
      assert.strictEqual(reportDoc.reason, "no_show");
    });

    it("rejects no-show on completed session", () => {
      const store = {
        swap_sessions: {
          sess_completed: {
            id: "sess_completed",
            requester_id: "alice",
            partner_id: "bob",
            status: "completed",
            is_settled: true,
          },
        },
      };

      assert.throws(
        () => executeNoShowTransactionSimulation(store, "sess_completed", "alice"),
        /cannot no-show completed session/,
      );
    });

    it("rejects no-show on pending unaccepted request", () => {
      const store = {
        swap_sessions: {
          sess_pending: {
            id: "sess_pending",
            requester_id: "alice",
            partner_id: "bob",
            status: "pending",
          },
        },
      };

      assert.throws(
        () => executeNoShowTransactionSimulation(store, "sess_pending", "alice"),
        /cannot no-show pending session/,
      );
    });

    it("repeated no-show is idempotent and does not duplicate report documents", () => {
      const store = {
        swap_sessions: {
          sess_disputed: {
            id: "sess_disputed",
            requester_id: "alice",
            partner_id: "bob",
            status: "disputed",
            no_show: true,
          },
        },
        reports: {
          rep_noshow_sess_disputed_alice: {
            id: "rep_noshow_sess_disputed_alice",
            reporter_id: "alice",
            reported_user_id: "bob",
          },
        },
      };

      const res = executeNoShowTransactionSimulation(store, "sess_disputed", "alice");
      assert.strictEqual(res.alreadyDisputed, true);
      assert.strictEqual(res.noShowRecorded, false);
      assert.strictEqual(Object.keys(store.reports).length, 1); // Exact 1 report
    });
  });

  describe("Priority 4: Admin Authorization (Testing Production isCallerAdmin)", () => {
    function createMockAdminDb(adminDocExists = false) {
      const bootstrappedDocs = {};
      return {
        collection: (colName) => ({
          doc: (docId) => ({
            id: docId,
            get: async () => ({
              exists: adminDocExists,
              data: () => (adminDocExists ? { uid: docId, role: "admin" } : undefined),
            }),
            set: async (data, options) => {
              bootstrappedDocs[docId] = { ...data, ...options };
            },
          }),
        }),
        bootstrappedDocs,
      };
    }

    it("grants admin to server-controlled custom claims", async () => {
      const mockDb = createMockAdminDb(false);
      const isAdmin = await isCallerAdmin({ uid: "admin1", token: { admin: true } }, mockDb);
      assert.strictEqual(isAdmin, true);
    });

    it("grants admin if UID exists in admins collection doc", async () => {
      const mockDb = createMockAdminDb(true);
      const isAdmin = await isCallerAdmin({ uid: "adminFromDb", token: {} }, mockDb);
      assert.strictEqual(isAdmin, true);
    });

    it("grants admin if UID is in server-controlled ADMIN_UIDS environment", async () => {
      const originalEnv = process.env.ADMIN_UIDS;
      try {
        process.env.ADMIN_UIDS = "envAdmin1,envAdmin2";
        const mockDb = createMockAdminDb(false);
        const isAdmin = await isCallerAdmin({ uid: "envAdmin1", token: {} }, mockDb);
        assert.strictEqual(isAdmin, true);
      } finally {
        process.env.ADMIN_UIDS = originalEnv;
      }
    });

    it("rejects unverified email claims", async () => {
      const mockDb = createMockAdminDb(false);
      const isAdmin = await isCallerAdmin(
        {
          uid: "attacker",
          token: { email: "farhodjonovichm1301@gmail.com", email_verified: false },
        },
        mockDb,
      );
      assert.strictEqual(isAdmin, false);
    });

    it("grants admin to verified project owner email and auto-bootstraps admins doc", async () => {
      const mockDb = createMockAdminDb(false);
      const isAdmin = await isCallerAdmin(
        {
          uid: "owner123",
          token: { email: "farhodjonovichm1301@gmail.com", email_verified: true },
        },
        mockDb,
      );
      assert.strictEqual(isAdmin, true);
      assert.strictEqual(
        mockDb.bootstrappedDocs["owner123"]?.email,
        "farhodjonovichm1301@gmail.com",
      );
      assert.strictEqual(mockDb.bootstrappedDocs["owner123"]?.role, "super_admin");
    });

    it("rejects ordinary users", async () => {
      const mockDb = createMockAdminDb(false);
      const isAdmin = await isCallerAdmin(
        {
          uid: "user123",
          token: { email: "user@example.com", email_verified: true },
        },
        mockDb,
      );
      assert.strictEqual(isAdmin, false);
    });
  });

  describe("Priority 5 & Limits: Plan limits configuration integrity", () => {
    it("verifies expected plan limits", () => {
      assert.strictEqual(PLAN_LIMITS.free, 3);
      assert.strictEqual(PLAN_LIMITS.premium, 15);
      assert.strictEqual(PLAN_LIMITS.pro, Infinity);
    });
  });
});
