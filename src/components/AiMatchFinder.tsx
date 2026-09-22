import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { MatchCard } from "@/components/MatchCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { recommendPartners, type RecommendPartnersResult } from "@/lib/ai-match.functions";
import { matchScore, type ProfileWithSkills } from "@/lib/peerswap";

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
  const recommend = useServerFn(recommendPartners);

  const mutation = useMutation<RecommendPartnersResult, Error, string>({
    mutationFn: (value) => recommend({ data: { need: value } }),
    onError: () => toast.error("Tavsiyalarni olishning iloji bo‘lmadi. Birozdan so‘ng qayta urinib ko‘ring."),
  });

  const result = mutation.data;
  const byId = new Map(profiles.map((p) => [p.id, p]));

  return (
    <section className="surface-card mt-6 p-6">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-accent" aria-hidden />
        <h2 className="font-semibold">AI yordamida hamkor tanlash</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Nimani o‘rganmoqchi ekaningizni va nimani o‘rgata olishingizni yozing — sizga mos hamkorlar tavsiya qilinadi.
      </p>

      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const value = need.trim();
          if (value.length < 3) {
            toast.error("Ehtiyojingizni bir-ikki jumlada yozing.");
            return;
          }
          mutation.mutate(value);
        }}
      >
        <Textarea
          value={need}
          onChange={(e) => setNeed(e.target.value)}
          rows={3}
          maxLength={600}
          placeholder="Masalan: Men React’ni chuqurroq o‘rganmoqchiman, buning evaziga ingliz tilida gapirishni o‘rgata olaman."
        />
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Tavsiyalar tayyorlanmoqda…" : "Mos hamkorlarni topish"}
        </Button>
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
                      onRequested={onRequested}
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
