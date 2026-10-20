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

export type Candidate = {
  id: string;
  name: string;
  bio: string;
  teach: string[];
  learn: string[];
};

function normalizeText(text: string): string {
  return text.toLowerCase().trim();
}

export function calculateMatch(
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
