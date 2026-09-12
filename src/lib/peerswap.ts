import { supabase } from "@/integrations/supabase/client";

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
};

export type SwapSession = {
  id: string;
  requester_id: string;
  partner_id: string;
  requester_teaches: string;
  partner_teaches: string;
  status: "pending" | "accepted" | "completed";
  created_at: string;
  completed_at: string | null;
};

type RawProfile = {
  id: string;
  first_name: string;
  last_name: string;
  bio: string;
  peercoins: number;
  is_active: boolean;
  is_demo: boolean;
  created_at: string;
  user_skills?: { skill: string; kind: string }[] | null;
};

function mapProfile(row: RawProfile): ProfileWithSkills {
  const skills = row.user_skills ?? [];
  return {
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    bio: row.bio,
    peercoins: row.peercoins,
    is_active: row.is_active,
    is_demo: row.is_demo,
    created_at: row.created_at,
    teach: skills.filter((s) => s.kind === "teach").map((s) => s.skill),
    learn: skills.filter((s) => s.kind === "learn").map((s) => s.skill),
  };
}

const PROFILE_SELECT = "id, first_name, last_name, bio, peercoins, is_active, is_demo, created_at, user_skills(skill, kind)";

export async function fetchProfiles(): Promise<ProfileWithSkills[]> {
  const { data, error } = await supabase.from("profiles").select(PROFILE_SELECT);
  if (error) throw error;
  return ((data ?? []) as RawProfile[]).map(mapProfile);
}

export async function fetchProfile(id: string): Promise<ProfileWithSkills | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapProfile(data as RawProfile) : null;
}

export async function fetchMySessions(userId: string): Promise<SwapSession[]> {
  const { data, error } = await supabase
    .from("swap_sessions")
    .select("*")
    .or(`requester_id.eq.${userId},partner_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SwapSession[];
}

/** Weekly PeerPoint allowance per plan. Pro is unlimited (allowance null). */
export type Plan = "free" | "premium" | "pro";
export const PLAN_ALLOWANCE: Record<Exclude<Plan, "pro">, number> = { free: 3, premium: 15 };

export type WeeklyPoints = {
  weekStart: string;
  used: number;
  /** null = unlimited (Pro plan). */
  allowance: number | null;
  /** null = unlimited (Pro plan). */
  remaining: number | null;
  plan: Plan;
  daysUntilReset: number;
};

export async function fetchWeeklyPoints(userId: string): Promise<WeeklyPoints> {
  const { data, error } = await supabase.rpc("refresh_weekly_points", { _user_id: userId });
  if (error) throw error;
  const row = (data ?? [])[0];
  const weekStart = row?.week_start ?? new Date().toISOString().slice(0, 10);
  const used = row?.used ?? 0;
  const plan = ((row as { plan?: string } | undefined)?.plan ?? "free") as Plan;
  const allowance = (row?.allowance ?? PLAN_ALLOWANCE.free) as number | null;
  const elapsed = Math.floor((Date.now() - new Date(`${weekStart}T00:00:00`).getTime()) / 86_400_000);
  return {
    weekStart,
    used,
    allowance,
    remaining: allowance == null ? null : Math.max(0, allowance - used),
    plan,
    daysUntilReset: Math.max(0, 7 - Math.min(7, Math.max(0, elapsed))),
  };
}

/** Switches the signed-in user's subscription plan. */
export async function updateMyPlan(userId: string, plan: Plan): Promise<void> {
  const { error } = await supabase.from("profiles").update({ plan }).eq("id", userId);
  if (error) throw error;
}

/** Spends one weekly PeerPoint. Throws when the allowance is used up. */
export async function spendPeerPoint(): Promise<number> {
  const { data, error } = await supabase.rpc("spend_peerpoint");
  if (error) throw error;
  return data as number;
}

export type MatchResult = {
  score: number;
  label: string;
  iTeach: string[];
  theyTeach: string[];
};

const norm = (s: string) => s.trim().toLowerCase();

/** Simple deterministic two-way matching. */
export function matchScore(
  me: Pick<ProfileWithSkills, "teach" | "learn">,
  other: Pick<ProfileWithSkills, "teach" | "learn">,
): MatchResult {
  const myLearn = me.learn.map(norm);
  const myTeach = me.teach.map(norm);
  const theyTeach = other.teach.filter((s) => myLearn.includes(norm(s)));
  const iTeach = me.teach.filter((s) => other.learn.map(norm).includes(norm(s)));
  void myTeach;

  const both = theyTeach.length > 0 && iTeach.length > 0;
  const one = theyTeach.length > 0 || iTeach.length > 0;
  const score = both ? 95 : one ? 60 : 0;

  return {
    score,
    label: both ? "Great skill exchange" : one ? "One-way match" : "No match",
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
  return `${p.first_name} ${p.last_name}`.trim() || "PeerSwap member";
}

export function initials(p: { first_name: string; last_name: string }) {
  return `${p.first_name[0] ?? "P"}${p.last_name[0] ?? ""}`.toUpperCase();
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
