import { RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { doc, setDoc } from "firebase/firestore";

import { MatchCard } from "@/components/MatchCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  calculateMatch,
  type RecommendQuality,
  type PartnerRecommendation,
  type RecommendPartnersResult,
} from "@/lib/ai-match.functions";
import { matchScore, type ProfileWithSkills } from "@/lib/peerswap";
import { db } from "@/lib/firebase";

const QUALITY_OPTIONS: Array<{ value: RecommendQuality; label: string; hint: string }> = [
  { value: "fast", label: "Tez", hint: "Qisqa izohlar, eng tez natija" },
  { value: "balanced", label: "Muvozanatli", hint: "Sifat va tezlik o‘rtasida" },
  { value: "deep", label: "Chuqur", hint: "Batafsil tahlil, eng yuqori aniqlik" },
];

export function AiMatchFinder({
  me,
  profiles,
  requestedIds,
  pointsLeft,
  onRequested,
}: {
  me: ProfileWithSkills | undefined;
  profiles: ProfileWithSkills[];
  requestedIds: Set<string>;
  pointsLeft?: number | null;
  onRequested?: () => void;
}) {
  const [need, setNeed] = useState("");
  const [quality, setQuality] = useState<RecommendQuality>("balanced");
  const [isPending, setIsPending] = useState(false);
  const [result, setResult] = useState<RecommendPartnersResult | null>(null);

  const byId = new Map(profiles.map((p) => [p.id, p]));

  const run = async (nextQuality: RecommendQuality) => {
    const value = need.trim();
    if (value.length < 3) {
      toast.error("Ehtiyojingizni bir-ikki jumlada yozing.");
      return;
    }

    setIsPending(true);

    try {
      const candidates = profiles
        .filter((p) => p.id !== me?.id && p.is_active)
        .map((p) => ({
          id: p.id,
          name: `${p.first_name} ${p.last_name}`.trim(),
          bio: p.bio,
          teach: p.teach,
          learn: p.learn,
        }));

      if (candidates.length === 0) {
        setResult({
          recommendations: [],
          note: "Hozircha tavsiya qilish uchun boshqa faol hamkor topilmadi.",
        });
        setIsPending(false);
        return;
      }

      const scored = candidates.map((cand) => {
        const match = calculateMatch(value, me?.teach ?? [], me?.learn ?? [], cand);
        return {
          id: cand.id,
          score: match.score,
          reason: match.reason,
        };
      });

      scored.sort((a, b) => b.score - a.score);

      const maxCount = nextQuality === "fast" ? 3 : nextQuality === "deep" ? 6 : 4;
      const recommendations: PartnerRecommendation[] = scored.slice(0, maxCount);

      const note =
        recommendations.length > 0
          ? `"${value}" bo‘yicha eng mos ${recommendations.length} ta hamkor saralab olindi.`
          : "Afsuski, kiritilgan talabga mos hamkor hozircha topilmadi.";

      const res = { recommendations, note };
      setResult(res);

      // Async write to Firestore ai_recommendations history if user is logged in
      if (me?.id) {
        const recId = `ai_rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        try {
          await setDoc(doc(db, "ai_recommendations", recId), {
            id: recId,
            user_id: me.id,
            need: value,
            quality: nextQuality,
            note,
            recommendations,
            created_at: new Date().toISOString(),
          });
        } catch {
          // ignore non-critical analytics write
        }
      }
    } catch (err: unknown) {
      console.error(err);
      toast.error("Tavsiyalarni olishda xatolik yuz berdi.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <section className="surface-card mt-6 p-6 rounded-2xl border border-border">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-accent" aria-hidden />
        <h2 className="font-semibold text-lg">AI yordamida hamkor tanlash</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Nimani o‘rganmoqchi ekaningizni va nimani o‘rgata olishingizni yozing — sizga mos hamkorlar
        saralab beriladi.
      </p>

      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(quality);
        }}
      >
        <Textarea
          value={need}
          onChange={(e) => setNeed(e.target.value)}
          rows={3}
          maxLength={600}
          placeholder="Masalan: Men Python va Django backendni chuqurroq o‘rganmoqchiman, evaziga Figma va UI/UX dizaynni o‘rgata olaman."
        />

        <div>
          <p className="text-sm font-medium">Tavsiya sifati</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {QUALITY_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                type="button"
                variant={quality === opt.value ? "default" : "outline"}
                size="sm"
                title={opt.hint}
                aria-pressed={quality === opt.value}
                onClick={() => {
                  setQuality(opt.value);
                  if (result) run(opt.value);
                }}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {QUALITY_OPTIONS.find((o) => o.value === quality)?.hint}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Tavsiyalar tayyorlanmoqda…" : "Mos hamkorlarni topish"}
          </Button>
          {result ? (
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => run(quality)}
            >
              <RefreshCw className={`size-4 ${isPending ? "animate-spin" : ""}`} aria-hidden />
              Qayta yangilash
            </Button>
          ) : null}
        </div>
      </form>

      {result ? (
        <div className="mt-6">
          {result.note ? (
            <p className="text-sm text-muted-foreground font-medium">{result.note}</p>
          ) : null}
          {result.recommendations.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              So‘rovingizga mos hamkor topilmadi. Ehtiyojingizni boshqacha ta’riflab ko‘ring.
            </p>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {result.recommendations.map((rec) => {
                const profile = byId.get(rec.id);
                if (!profile) return null;
                const skills = me
                  ? matchScore(me, profile)
                  : { score: rec.score, label: "", iTeach: [], theyTeach: [] };
                return (
                  <div key={rec.id} className="space-y-2">
                    <MatchCard
                      profile={profile}
                      match={{ ...skills, score: rec.score, label: rec.reason }}
                      meId={me?.id ?? ""}
                      alreadyRequested={requestedIds.has(rec.id)}
                      pointsLeft={pointsLeft ?? null}
                      onRequested={() => onRequested?.()}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
