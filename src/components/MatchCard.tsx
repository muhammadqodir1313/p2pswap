import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SkillTags } from "@/components/SkillTags";
import { supabase } from "@/integrations/supabase/client";
import {
  fullName,
  initials,
  spendPeerPoint,
  type MatchResult,
  type ProfileWithSkills,
} from "@/lib/peerswap";

export function MatchCard({
  profile,
  match,
  meId,
  alreadyRequested,
  pointsLeft,
  onRequested,
}: {
  profile: ProfileWithSkills;
  match: MatchResult;
  meId: string;
  alreadyRequested?: boolean;
  /** null or omitted = unlimited / unknown. */
  pointsLeft?: number | null;
  onRequested?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const outOfPoints = pointsLeft !== undefined && pointsLeft !== null && pointsLeft <= 0;

  async function requestSwap() {
    setBusy(true);
    try {
      await spendPeerPoint();
    } catch {
      setBusy(false);
      toast.error("Bu haftadagi barcha PeerPointlaringiz ishlatildi. Ular keyingi hafta tiklanadi.");
      onRequested?.();
      return;
    }

    const { error } = await supabase.from("swap_sessions").insert({
      requester_id: meId,
      partner_id: profile.id,
      requester_teaches: match.iTeach.join(", ") || "Kelishiladi",
      partner_teaches: match.theyTeach.join(", ") || "Kelishiladi",
    });
    setBusy(false);
    if (error) {
      toast.error("Almashinuv so‘rovini yuborib bo‘lmadi. Qayta urinib ko‘ring.");
      onRequested?.();
      return;
    }
    setSent(true);
    toast.success("Almashinuv so‘rovi yuborildi — 1 PeerPoint ishlatildi.");
    onRequested?.();
  }

  const requested = sent || alreadyRequested;

  return (
    <article className="surface-card flex flex-col gap-4 p-5 transition-colors hover:border-primary/50">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-accent">
            {initials(profile)}
          </span>
          <div>
            <h3 className="font-semibold">{fullName(profile)}</h3>
            <p className="line-clamp-2 text-xs text-muted-foreground">{profile.bio}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-accent">{match.score}%</p>
          <p className="text-[11px] text-muted-foreground">Moslik</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="mb-1.5 text-xs uppercase tracking-wide text-muted-foreground">O‘rgata oladi</p>
          <SkillTags skills={profile.teach} tone="teach" />
        </div>
        <div>
          <p className="mb-1.5 text-xs uppercase tracking-wide text-muted-foreground">O‘rganmoqchi</p>
          <SkillTags skills={profile.learn} tone="learn" />
        </div>
      </div>

      <p className="text-xs text-accent">{match.label}</p>

      <Button onClick={requestSwap} disabled={busy || requested || outOfPoints} className="mt-auto">
        {requested
          ? "So‘rov yuborildi"
          : busy
            ? "Yuborilmoqda…"
            : outOfPoints
              ? "Bu hafta PeerPoint qolmadi"
              : "Almashinuv so‘rovi (1 PeerPoint)"}
      </Button>
    </article>
  );
}
