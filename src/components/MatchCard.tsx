import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SkillTags } from "@/components/SkillTags";
import { supabase } from "@/integrations/supabase/client";
import { fullName, initials, type MatchResult, type ProfileWithSkills } from "@/lib/peerswap";

export function MatchCard({
  profile,
  match,
  meId,
  alreadyRequested,
  onRequested,
}: {
  profile: ProfileWithSkills;
  match: MatchResult;
  meId: string;
  alreadyRequested?: boolean;
  onRequested?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function requestSwap() {
    setBusy(true);
    const { error } = await supabase.from("swap_sessions").insert({
      requester_id: meId,
      partner_id: profile.id,
      requester_teaches: match.iTeach.join(", ") || "To be agreed",
      partner_teaches: match.theyTeach.join(", ") || "To be agreed",
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success("Swap request sent!");
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
          <p className="text-[11px] text-muted-foreground">Match</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="mb-1.5 text-xs uppercase tracking-wide text-muted-foreground">Can teach</p>
          <SkillTags skills={profile.teach} tone="teach" />
        </div>
        <div>
          <p className="mb-1.5 text-xs uppercase tracking-wide text-muted-foreground">Wants to learn</p>
          <SkillTags skills={profile.learn} tone="learn" />
        </div>
      </div>

      <p className="text-xs text-accent">{match.label}</p>

      <Button onClick={requestSwap} disabled={busy || requested} className="mt-auto">
        {requested ? "Request sent" : busy ? "Sending…" : "Request Swap"}
      </Button>
    </article>
  );
}
