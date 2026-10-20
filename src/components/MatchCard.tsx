import { useState } from "react";
import { toast } from "sonner";
import { doc, setDoc } from "firebase/firestore";
import { Link } from "@tanstack/react-router";
import { AlertCircle, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SkillTags } from "@/components/SkillTags";
import { db } from "@/lib/firebase";
import {
  fullName,
  initials,
  spendPeerPoint,
  type MatchResult,
  type ProfileWithSkills,
} from "@/lib/peerswap";
import { callCreateSwapRequest } from "@/lib/functions";

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
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [limitErrorMsg, setLimitErrorMsg] = useState("");

  const outOfPoints = pointsLeft !== undefined && pointsLeft !== null && pointsLeft <= 0;

  async function requestSwap() {
    if (outOfPoints) {
      setLimitErrorMsg(
        "Bu haftadagi barcha dars almashinuv limitingiz tugadi (Free = 3 ta dars/hafta, Premium = 15 ta dars/hafta). Cheksiz darslar uchun Pro rejaga o‘ting.",
      );
      setLimitModalOpen(true);
      return;
    }

    setBusy(true);

    try {
      // 1. First attempt server-side Cloud Function to enforce limits & atomic creation
      const res = await callCreateSwapRequest({
        partnerId: profile.id,
        requesterTeaches: match.iTeach.join(", ") || "Kelishiladi",
        partnerTeaches: match.theyTeach.join(", ") || "Kelishiladi",
        learnerId: meId,
        teacherId: profile.id,
      });

      setSent(true);
      toast.success(
        res.message || "Almashinuv so‘rovi yuborildi — 1 haftalik dars kvotasi ishlatildi.",
      );
      onRequested?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);

      // Check if server rejected due to weekly limit exhaustion
      if (
        msg.includes("limit") ||
        msg.includes("resource-exhausted") ||
        msg.includes("3 ta dars") ||
        msg.includes("15 ta")
      ) {
        setLimitErrorMsg(msg);
        setLimitModalOpen(true);
        setBusy(false);
        return;
      }

      // Fallback: direct firestore write if function is not available in local environment
      try {
        await spendPeerPoint();
        const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await setDoc(doc(db, "swap_sessions", sessionId), {
          id: sessionId,
          requester_id: meId,
          partner_id: profile.id,
          requester_teaches: match.iTeach.join(", ") || "Kelishiladi",
          partner_teaches: match.theyTeach.join(", ") || "Kelishiladi",
          learner_id: meId,
          teacher_id: profile.id,
          status: "pending",
          requester_confirmed: false,
          partner_confirmed: false,
          created_at: new Date().toISOString(),
          completed_at: null,
        });

        setSent(true);
        toast.success("Almashinuv so‘rovi yuborildi — 1 PeerPoint ishlatildi.");
        onRequested?.();
      } catch (innerErr: unknown) {
        console.error(innerErr);
        toast.error("Almashinuv so‘rovini yuborib bo‘lmadi. Qayta urinib ko‘ring.");
        onRequested?.();
      }
    } finally {
      setBusy(false);
    }
  }

  const requested = sent || alreadyRequested;

  return (
    <>
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
            <p className="mb-1.5 text-xs uppercase tracking-wide text-muted-foreground">
              O‘rgata oladi
            </p>
            <SkillTags skills={profile.teach} tone="teach" />
          </div>
          <div>
            <p className="mb-1.5 text-xs uppercase tracking-wide text-muted-foreground">
              O‘rganmoqchi
            </p>
            <SkillTags skills={profile.learn} tone="learn" />
          </div>
        </div>

        <p className="text-xs text-accent">{match.label}</p>

        <div className="mt-auto pt-2">
          {requested ? (
            <Button disabled variant="secondary" className="w-full">
              So‘rov yuborilgan
            </Button>
          ) : (
            <Button
              onClick={requestSwap}
              disabled={busy}
              className={
                "w-full " +
                (outOfPoints
                  ? "border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                  : "bg-brand-gradient text-primary-foreground hover:opacity-90")
              }
            >
              {busy
                ? "Yuborilmoqda…"
                : outOfPoints
                  ? "Haftalik limit tugagan (Tarifni yangilang)"
                  : "Almashinuv so‘rovini yuborish (1 dars)"}
            </Button>
          )}
        </div>
      </article>

      {/* Clear Weekly Limit UI Error Modal */}
      <Dialog open={limitModalOpen} onOpenChange={setLimitModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400">
              <AlertCircle className="size-5" />
              Haftalik dars limiti tugadi
            </DialogTitle>
            <DialogDescription className="text-foreground/90 pt-1">
              {limitErrorMsg ||
                "Siz ushbu haftaga ajratilgan dars almashinuv kvotangizdan to‘liq foydalandingiz."}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-border bg-secondary/40 p-4 space-y-2.5 text-xs">
            <p className="font-semibold text-foreground">Tariflar bo‘yicha haftalik limitlar:</p>
            <ul className="space-y-1.5 text-muted-foreground list-disc pl-4">
              <li>
                <strong className="text-foreground">Free:</strong> haftasiga 3 ta dars / PeerPoint
              </li>
              <li>
                <strong className="text-foreground">Premium:</strong> haftasiga 15 ta dars /
                PeerPoint
              </li>
              <li>
                <strong className="text-accent font-semibold">Pro:</strong> Cheksiz darslar va
                ustuvor moslashuv
              </li>
            </ul>
            <p className="text-[11px] text-muted-foreground pt-1">
              Dars kvotalari har dushanba soat 00:00 da (Toshkent vaqti) avtomatik tarzda qayta
              yangilanadi.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setLimitModalOpen(false)}>
              Tushundim
            </Button>
            <Button asChild className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/subscription">
                <Sparkles className="size-3.5" />
                Tarifni oshirish (Upgrade)
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
