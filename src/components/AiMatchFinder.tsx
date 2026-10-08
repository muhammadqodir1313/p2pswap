import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { MatchCard } from "@/components/MatchCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  recommendPartners,
  type RecommendPartnersResult,
  type RecommendQuality,
} from "@/lib/ai-match.functions";
import { matchScore, type ProfileWithSkills } from "@/lib/peerswap";

const QUALITY_OPTIONS: Array<{ value: RecommendQuality; label: string; hint: string }> = [
  { value: "fast", label: "Tez", hint: "Qisqa izohlar, eng tez natija" },
  { value: "balanced", label: "Muvozanatli", hint: "Sifat va tezlik o‘rtasida" },
  { value: "deep", label: "Chuqur", hint: "Batafsil tahlil, sekinroq" },
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
  const recommend = useServerFn(recommendPartners);

  const mutation = useMutation<
    RecommendPartnersResult,
    Error,
    { need: string; quality: RecommendQuality }
  >({
    mutationFn: (value) => recommend({ data: value }),
    onError: () =>
      toast.error("Tavsiyalarni olishning iloji bo‘lmadi. Birozdan so‘ng qayta urinib ko‘ring."),
  });

  const result = mutation.data;
  const byId = new Map(profiles.map((p) => [p.id, p]));

  const run = (nextQuality: RecommendQuality) => {
    const value = need.trim();
    if (value.length < 3) {
      toast.error("Ehtiyojingizni bir-ikki jumlada yozing.");
      return;
    }
    mutation.mutate({ need: value, quality: nextQuality });
  };

  return (
    <section className="surface-card mt-6 p-6">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-accent" aria-hidden />
        <h2 className="font-semibold">AI yordamida hamkor tanlash</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Nimani o‘rganmoqchi ekaningizni va nimani o‘rgata olishingizni yozing — sizga mos hamkorlar
        tavsiya qilinadi.
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
          placeholder="Masalan: Men React’ni chuqurroq o‘rganmoqchiman, buning evaziga ingliz tilida gapirishni o‘rgata olaman."
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
                  if (result || mutation.isError) run(opt.value);
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
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Tavsiyalar tayyorlanmoqda…" : "Mos hamkorlarni topish"}
          </Button>
          {result || mutation.isError ? (
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => run(quality)}
            >
              <RefreshCw
                className={`size-4 ${mutation.isPending ? "animate-spin" : ""}`}
                aria-hidden
              />
              Qayta o‘qish
            </Button>
          ) : null}
        </div>
      </form>

      {result ? (
        <div className="mt-6">
          {result.note ? <p className="text-sm text-muted-foreground">{result.note}</p> : null}
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
