import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "./firebase";
import { callCancelSubscription, callRequestPlanUpgrade } from "./functions";

export type SkillKind = "teach" | "learn";

export type ProfileWithSkills = {
  id: string;
  first_name: string;
  last_name: string;
  bio: string;
  peercoins: number;
  is_active: boolean;
  is_demo: boolean;
  created_at: string;
  teach: string[];
  learn: string[];
  plan?: Plan;
};

export type SwapSession = {
  id: string;
  requester_id: string;
  partner_id: string;
  requester_teaches: string;
  partner_teaches: string;
  status: "pending" | "accepted" | "completed" | "disputed" | "needs_review";
  created_at: string;
  completed_at: string | null;
  requester_confirmed?: boolean;
  requester_confirmed_at?: string;
  partner_confirmed?: boolean;
  partner_confirmed_at?: string;
  no_show?: boolean;
  no_show_reported_by?: string;
  no_show_reason?: string;
  review_reason?: string;
  flagged_for_admin?: boolean;
};

export type Plan = "free" | "premium" | "pro";
export const PLAN_ALLOWANCE: Record<Exclude<Plan, "pro">, number> = { free: 3, premium: 15 };

export type WeeklyPoints = {
  weekStart: string;
  used: number;
  allowance: number | null;
  remaining: number | null;
  plan: Plan;
  daysUntilReset: number;
};

// Realistic Uzbek demo profiles for PeerSwap
const DEMO_PROFILES: ProfileWithSkills[] = [
  {
    id: "demo-user-1",
    first_name: "Jasur",
    last_name: "Karimov",
    bio: "Senior Python va Django dasturchi. Backend arxitekturasi va REST API yaratish bo‘yicha 4 yillik tajribaga egaman. Evaziga UI/UX dizayn o‘rganmoqchiman.",
    peercoins: 25,
    is_active: true,
    is_demo: true,
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    teach: ["Python", "Django", "PostgreSQL", "Docker", "API dizayn"],
    learn: ["Figma", "UI/UX Dizayn", "Frontend Asoslari"],
    plan: "premium",
  },
  {
    id: "demo-user-2",
    first_name: "Nilufar",
    last_name: "Saidova",
    bio: "Product Designer (Figma, Adobe Illustrator). Mobil ilovalar va veb-saytlar dizaynini o‘rgataman. Ingliz tili IELTS 7.5 darajasiga chiqish uchun speaking mashg‘ulotlari qidiryapman.",
    peercoins: 30,
    is_active: true,
    is_demo: true,
    created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
    teach: ["Figma", "UI/UX Dizayn", "Mobil Dizayn", "Wireframing"],
    learn: ["Ingliz tili", "Speaking Practice", "IELTS"],
    plan: "pro",
  },
  {
    id: "demo-user-3",
    first_name: "Sardorbek",
    last_name: "Aliyev",
    bio: "IELTS 8.0 sohibi. Akademik ingliz tili, talaffuz va essay yozish bo‘yicha yordam bera olaman. O‘rniga React va Next.js bo‘yicha amaliy darslar qidirmoqdaman.",
    peercoins: 18,
    is_active: true,
    is_demo: true,
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    teach: ["Ingliz tili", "IELTS Speaking", "Academic Writing", "Grammatika"],
    learn: ["React", "TypeScript", "Next.js"],
    plan: "free",
  },
  {
    id: "demo-user-4",
    first_name: "Madina",
    last_name: "Umarova",
    bio: "Raqamli marketing va SMM bo‘yicha mutaxassis. Target reklama, kontent rejalashtirish va Reels yaratishni o‘rgataman. Ma'lumotlar tahlili (SQL va Excel) bo‘yicha hamkor qidiryapman.",
    peercoins: 15,
    is_active: true,
    is_demo: true,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    teach: ["SMM", "Targeting", "Kopirayting", "Instagram Strategiya"],
    learn: ["SQL", "Excel Analitika", "Python"],
    plan: "free",
  },
  {
    id: "demo-user-5",
    first_name: "Bobur",
    last_name: "Temirov",
    bio: "Fullstack React va Node.js dasturchi. Zamonaviy web loyihalar yaratish, Tailwind CSS va TypeScript bo‘yicha mahorat darslari o‘taman. Mobil dasturlash (Flutter)ni noldan o‘rganish niyatidaman.",
    peercoins: 40,
    is_active: true,
    is_demo: true,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    teach: ["React", "Node.js", "TypeScript", "Tailwind CSS"],
    learn: ["Flutter", "Dart", "Mobil Dasturlash"],
    plan: "premium",
  },
];

let isSeedingDone = false;

export async function seedDemoDataIfEmpty() {
  if (isSeedingDone) return;
  try {
    const colRef = collection(db, "profiles");
    const snapshot = await getDocs(colRef);
    if (snapshot.size === 0) {
      console.log("[PeerSwap] Firestore profiles collection is empty. Seeding demo data...");
      for (const p of DEMO_PROFILES) {
        await setDoc(doc(db, "profiles", p.id), p);
      }

      // Also seed sample swap sessions
      const sampleSessions: SwapSession[] = [
        {
          id: "demo-session-1",
          requester_id: "demo-user-1",
          partner_id: "demo-user-2",
          requester_teaches: "Python Asoslari",
          partner_teaches: "Figma UI Asoslari",
          status: "accepted",
          created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
          completed_at: null,
        },
        {
          id: "demo-session-2",
          requester_id: "demo-user-3",
          partner_id: "demo-user-5",
          requester_teaches: "IELTS Speaking Practice",
          partner_teaches: "React Component Architecture",
          status: "completed",
          created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
          completed_at: new Date(Date.now() - 86400000 * 3).toISOString(),
        },
      ];

      for (const s of sampleSessions) {
        await setDoc(doc(db, "swap_sessions", s.id), s);
      }

      // Also seed calendar slots
      const sampleSlots = [
        {
          id: "demo-slot-1",
          owner_id: "demo-user-1",
          partner_id: null,
          kind: "teach",
          skill: "Python & REST API",
          description:
            "RESTful API tuzilmasi va ma'lumotlar bazasi integratsiyasini ko‘rib chiqamiz.",
          is_online: true,
          starts_at: new Date(Date.now() + 86400000).toISOString(),
          ends_at: new Date(Date.now() + 86400000 + 3600000).toISOString(),
          status: "open",
          peerpoint_cost: 1,
          created_at: new Date().toISOString(),
          owner_done: false,
          partner_done: false,
        },
        {
          id: "demo-slot-2",
          owner_id: "demo-user-2",
          partner_id: null,
          kind: "teach",
          skill: "Figma Autolayout & Komponentlar",
          description: "Figma-da zamonaviy dizayn tizimlari va avtomatik o‘lchamlar bilan ishlash.",
          is_online: true,
          starts_at: new Date(Date.now() + 86400000 * 2).toISOString(),
          ends_at: new Date(Date.now() + 86400000 * 2 + 3600000).toISOString(),
          status: "open",
          peerpoint_cost: 1,
          created_at: new Date().toISOString(),
          owner_done: false,
          partner_done: false,
        },
      ];

      for (const sl of sampleSlots) {
        await setDoc(doc(db, "calendar_slots", sl.id), sl);
      }

      console.log("[PeerSwap] Demo data seeding completed successfully.");
    }
    isSeedingDone = true;
  } catch (err) {
    console.warn("[PeerSwap] Note on demo seeding:", err);
  }
}

export async function fetchProfiles(): Promise<ProfileWithSkills[]> {
  const colPath = "profiles";
  try {
    await seedDemoDataIfEmpty();
    const snap = await getDocs(collection(db, colPath));
    const list: ProfileWithSkills[] = [];
    snap.forEach((d) => {
      const data = d.data();
      list.push({
        id: d.id,
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        bio: data.bio || "",
        peercoins: typeof data.peercoins === "number" ? data.peercoins : 10,
        is_active: data.is_active ?? true,
        is_demo: data.is_demo ?? false,
        created_at: data.created_at || new Date().toISOString(),
        teach: Array.isArray(data.teach) ? data.teach : [],
        learn: Array.isArray(data.learn) ? data.learn : [],
        plan: data.plan || "free",
      });
    });
    return list.length > 0 ? list : DEMO_PROFILES;
  } catch (err) {
    console.warn("Could not fetch profiles from firestore, using demo dataset:", err);
    return DEMO_PROFILES;
  }
}

export async function fetchProfile(id: string): Promise<ProfileWithSkills | null> {
  const docPath = `profiles/${id}`;
  try {
    const snap = await getDoc(doc(db, "profiles", id));
    if (snap.exists()) {
      const data = snap.data();
      return {
        id: snap.id,
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        bio: data.bio || "",
        peercoins: typeof data.peercoins === "number" ? data.peercoins : 10,
        is_active: data.is_active ?? true,
        is_demo: data.is_demo ?? false,
        created_at: data.created_at || new Date().toISOString(),
        teach: Array.isArray(data.teach) ? data.teach : [],
        learn: Array.isArray(data.learn) ? data.learn : [],
        plan: data.plan || "free",
      };
    }
    const demo = DEMO_PROFILES.find((p) => p.id === id);
    return demo || null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, docPath);
  }
}

export async function fetchMySessions(userId: string): Promise<SwapSession[]> {
  const colPath = "swap_sessions";
  try {
    const [q1, q2] = await Promise.all([
      getDocs(query(collection(db, colPath), where("requester_id", "==", userId))),
      getDocs(query(collection(db, colPath), where("partner_id", "==", userId))),
    ]);

    const seen = new Set<string>();
    const list: SwapSession[] = [];

    const addDoc = (d: { id: string; data: () => Record<string, unknown> }) => {
      if (seen.has(d.id)) return;
      seen.add(d.id);
      const data = d.data();
      list.push({
        id: d.id,
        requester_id: data.requester_id || "",
        partner_id: data.partner_id || "",
        requester_teaches: data.requester_teaches || "",
        partner_teaches: data.partner_teaches || "",
        status: data.status || "pending",
        created_at: data.created_at || new Date().toISOString(),
        completed_at: data.completed_at || null,
      });
    };

    q1.forEach(addDoc);
    q2.forEach(addDoc);

    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch (err) {
    console.warn("Could not query swap_sessions, returning empty list:", err);
    return [];
  }
}

export async function fetchWeeklyPoints(userId: string): Promise<WeeklyPoints> {
  try {
    const p = await fetchProfile(userId);
    const plan: Plan = p?.plan ?? "free";
    const allowance = plan === "pro" ? null : PLAN_ALLOWANCE[plan];

    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
    weekStart.setDate(diff);

    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const elapsed = Math.floor((Date.now() - weekStart.getTime()) / 86_400_000);

    return {
      weekStart: weekStartStr,
      used: 0,
      allowance,
      remaining: allowance,
      plan,
      daysUntilReset: Math.max(0, 7 - Math.min(7, Math.max(0, elapsed))),
    };
  } catch {
    return {
      weekStart: new Date().toISOString().slice(0, 10),
      used: 0,
      allowance: PLAN_ALLOWANCE.free,
      remaining: PLAN_ALLOWANCE.free,
      plan: "free",
      daysUntilReset: 7,
    };
  }
}

/**
 * Safe subscription plan update.
 * In accordance with PeerSwap security model:
 * - Paid plans (premium, pro) require verified payment/admin authorization and CANNOT be self-activated by client.
 * - Attempting an upgrade registers a pending request via callRequestPlanUpgrade without modifying profile.
 * - Downgrading to free calls callCancelSubscription to safely revert.
 */
export async function updateMyPlan(_userId: string, plan: Plan): Promise<void> {
  if (plan !== "free") {
    await callRequestPlanUpgrade(plan);
    return;
  }
  await callCancelSubscription();
}

export async function spendPeerPoint(): Promise<number> {
  return 1;
}

export type MatchResult = {
  score: number;
  label: string;
  iTeach: string[];
  theyTeach: string[];
};

const norm = (s: string) => s.trim().toLowerCase();

export function matchScore(
  me: Pick<ProfileWithSkills, "teach" | "learn">,
  other: Pick<ProfileWithSkills, "teach" | "learn">,
): MatchResult {
  const myLearn = me.learn.map(norm);
  const theyTeach = other.teach.filter((s) => myLearn.includes(norm(s)));
  const iTeach = me.teach.filter((s) => other.learn.map(norm).includes(norm(s)));

  const both = theyTeach.length > 0 && iTeach.length > 0;
  const one = theyTeach.length > 0 || iTeach.length > 0;
  const score = both ? 95 : one ? 60 : 0;

  return {
    score,
    label: both ? "Ajoyib o‘zaro moslik" : one ? "Bir tomonlama moslik" : "Moslik yo‘q",
    iTeach,
    theyTeach,
  };
}

export function rankMatches(me: ProfileWithSkills, everyone: ProfileWithSkills[]) {
  return everyone
    .filter((p) => p.id !== me.id && p.is_active)
    .map((p) => ({ profile: p, match: matchScore(me, p) }))
    .filter((m) => m.match.score > 0)
    .sort((a, b) => b.match.score - a.match.score);
}

export function fullName(p: { first_name: string; last_name: string }) {
  return `${p.first_name} ${p.last_name}`.trim() || "PeerSwap a’zosi";
}

export function initials(p: { first_name: string; last_name: string }) {
  return `${p.first_name[0] ?? "P"}${p.last_name[0] ?? ""}`.toUpperCase();
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("uz-UZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
