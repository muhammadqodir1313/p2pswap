import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RecommendInput = z.object({
  need: z.string().min(3).max(600),
  quality: z.enum(["fast", "balanced", "deep"]).default("balanced"),
});

export type RecommendQuality = "fast" | "balanced" | "deep";

export type PartnerRecommendation = {
  id: string;
  score: number;
  reason: string;
};

export type RecommendPartnersResult = {
  recommendations: PartnerRecommendation[];
  note: string;
};

type Candidate = {
  id: string;
  name: string;
  bio: string;
  teach: string[];
  learn: string[];
};

function normalizeText(text: string): string {
  return text.toLowerCase().trim();
}

function calculateMatch(
  need: string,
  userTeach: string[],
  userLearn: string[],
  candidate: Candidate,
): { score: number; reason: string } {
  const normNeed = normalizeText(need);
  const needWords = normNeed.split(/[\s,.;:!?/()]+/).filter((w) => w.length >= 2);

  let directTeachMatch: string | null = null;
  let partialTeachMatch: string | null = null;

  for (const skill of candidate.teach) {
    const normSkill = normalizeText(skill);
    if (normNeed.includes(normSkill) || normSkill.includes(normNeed)) {
      directTeachMatch = skill;
      break;
    }
    if (needWords.some((w) => normSkill.includes(w) || w.includes(normSkill))) {
      partialTeachMatch = skill;
    }
  }

  // Check reciprocal learning match (candidate wants what user teaches)
  let reciprocalMatch: string | null = null;
  for (const mySkill of userTeach) {
    const normMySkill = normalizeText(mySkill);
    for (const candLearn of candidate.learn) {
      const normCandLearn = normalizeText(candLearn);
      if (normCandLearn.includes(normMySkill) || normMySkill.includes(normCandLearn)) {
        reciprocalMatch = mySkill;
        break;
      }
    }
    if (reciprocalMatch) break;
  }

  // Base score calculation
  let score = 50;
  const reasons: string[] = [];

  if (directTeachMatch) {
    score += 35;
    reasons.push(`"${directTeachMatch}" bo‘yicha aynan siz izlagan bilimlarni o‘rgata oladi.`);
  } else if (partialTeachMatch) {
    score += 25;
    reasons.push(`"${partialTeachMatch}" ko‘nikmasi sizning ehtiyojingiz bilan yaqin mos keladi.`);
  } else if (candidate.teach.length > 0) {
    score += 15;
    reasons.push(
      `"${candidate.teach.slice(0, 2).join(", ")}" yo‘nalishlarida kuchli tajribaga ega.`,
    );
  }

  if (reciprocalMatch) {
    score += 15;
    reasons.push(
      `Siz o‘rgata oladigan "${reciprocalMatch}" hamkorga ham juda qiziq (ikki tomonlama ideal almashinuv!).`,
    );
  }

  if (candidate.bio && needWords.some((w) => normalizeText(candidate.bio).includes(w))) {
    score += 5;
  }

  // Clamp score
  score = Math.min(99, Math.max(60, score));

  const reasonText =
    reasons.length > 0
      ? reasons.join(" ")
      : `Hamkor ko‘nikmalari va tajribasi sizning qiziqishlaringizga mos keladi.`;

  return { score, reason: reasonText };
}

export const recommendPartners = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RecommendInput.parse(input))
  .handler(async ({ data, context }): Promise<RecommendPartnersResult> => {
    const { supabase, userId } = context;

    const { data: rows, error } = await supabase
      .from("peer_directory")
      .select("id, first_name, last_name, bio, is_active, teach, learn");
    if (error) throw new Error(error.message);

    const all = (rows ?? []) as Array<{
      id: string | null;
      first_name: string | null;
      last_name: string | null;
      bio: string | null;
      is_active: boolean | null;
      teach: string[] | null;
      learn: string[] | null;
    }>;

    const me = all.find((p) => p.id === userId);
    const candidates: Candidate[] = all
      .filter((p) => p.id && p.id !== userId && p.is_active !== false)
      .map((p) => ({
        id: p.id as string,
        name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "PeerSwap a’zosi",
        bio: p.bio ?? "",
        teach: p.teach ?? [],
        learn: p.learn ?? [],
      }));

    if (candidates.length === 0) {
      return { recommendations: [], note: "Hozircha tavsiya qilish uchun faol hamkor yo‘q." };
    }

    const scored = candidates.map((cand) => {
      const match = calculateMatch(data.need, me?.teach ?? [], me?.learn ?? [], cand);
      return {
        id: cand.id,
        score: match.score,
        reason: match.reason,
      };
    });

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    const maxCount = data.quality === "fast" ? 3 : 5;
    const recommendations: PartnerRecommendation[] = scored.slice(0, maxCount);

    const note =
      recommendations.length > 0
        ? `"${data.need}" bo‘yicha eng mos ${recommendations.length} ta hamkor saralab olindi.`
        : "Afsuski, kiritilgan talabga mos hamkor hozircha topilmadi.";

    // Save recommendations history (RLS: owner and admin only)
    try {
      await supabase.from("ai_recommendations").insert({
        user_id: userId,
        need: data.need,
        quality: data.quality,
        note,
        recommendations,
      });
    } catch (saveError) {
      console.warn("ai_recommendations insert warning", saveError);
    }

    return { recommendations, note };
  });
