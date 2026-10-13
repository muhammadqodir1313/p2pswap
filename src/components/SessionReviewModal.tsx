import { useState } from "react";
import { Star, ShieldAlert, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { markUserAttended } from "@/lib/session-room";

type SessionReviewModalProps = {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  isCalendarSlot?: boolean;
  userId: string;
  isOwner: boolean;
  partnerName: string;
  skillName: string;
  onCompleted?: () => void;
};

export function SessionReviewModal({
  isOpen,
  onClose,
  sessionId,
  isCalendarSlot = false,
  userId,
  isOwner,
  partnerName,
  skillName,
  onCompleted,
}: SessionReviewModalProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [didAttend, setDidAttend] = useState<"attended" | "not_attended">("attended");
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    setBusy(true);
    try {
      if (didAttend === "not_attended") {
        // User did NOT attend or partner didn't show up.
        // We MUST NOT deduct coins from this user!
        if (isCalendarSlot) {
          // Update slot to cancelled or open without deducting coins
          await supabase.from("calendar_slots").update({ status: "cancelled" }).eq("id", sessionId);
        } else {
          // For swap sessions, cancel or keep status without deduction
          await supabase.from("swap_sessions").update({ status: "pending" }).eq("id", sessionId);
        }

        toast.info(
          "Mashg‘ulotda qatnashilmadi deb qayd etildi. Balansingizdan hech qanday PeerPoint yechilmadi.",
        );
        onClose();
        onCompleted?.();
        return;
      }

      // User confirmed they attended
      markUserAttended(sessionId, isOwner);

      // Save feedback in database
      const feedbackPayload = {
        session_id: sessionId,
        user_id: userId,
        rating,
        comment: comment.trim() || "Mashg‘ulot muvaffaqiyatli o‘tdi.",
      };

      const { error: feedbackErr } = await supabase.from("feedback").insert(feedbackPayload);
      if (feedbackErr) {
        console.warn("Feedback table insert error (non-fatal):", feedbackErr);
      }

      // Safe completion based on slot type
      if (isCalendarSlot) {
        const { error: slotErr } = await supabase.rpc("set_calendar_slot_status", {
          _slot_id: sessionId,
          _status: "completed",
        });
        if (slotErr) {
          console.warn("RPC set_calendar_slot_status note:", slotErr.message);
          // Fallback direct update if needed
          await supabase
            .from("calendar_slots")
            .update({ [isOwner ? "owner_done" : "partner_done"]: true, status: "in_progress" })
            .eq("id", sessionId);
        }
      } else {
        const { error: swapErr } = await supabase.rpc("complete_session", {
          _session_id: sessionId,
        });
        if (swapErr) {
          await supabase
            .from("swap_sessions")
            .update({ status: "completed", completed_at: new Date().toISOString() })
            .eq("id", sessionId);
        }
      }

      toast.success(
        "Fikr-mulohazangiz va mashg‘ulotdagi ishtirokingiz qabul qilindi! PeerPointlar adolatli hisoblandi.",
      );
      onClose();
      onCompleted?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Amalni bajarib bo‘lmadi";
      toast.error(`Xatolik: ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-accent" />
            Sessiya yakuni va Baholash
          </DialogTitle>
          <DialogDescription>
            {skillName} bo‘yicha {partnerName} bilan o‘tkazilgan mashg‘ulot haqida fikr bildiring.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Attendance verification */}
          <div className="rounded-lg border border-border bg-secondary/40 p-3">
            <Label className="text-sm font-semibold">Siz mashg‘ulotda qatnashdingizmi?</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Coinlar faqat ikkala tomon haqiqatda qatnashgandagina adolatli o‘tkaziladi.
            </p>
            <div className="mt-2.5 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="attendance"
                  value="attended"
                  checked={didAttend === "attended"}
                  onChange={() => setDidAttend("attended")}
                  className="size-4 accent-accent"
                />
                <span>Ha, men mashg‘ulotda qatnashdim va bilim almashdik</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-amber-400 cursor-pointer">
                <input
                  type="radio"
                  name="attendance"
                  value="not_attended"
                  checked={didAttend === "not_attended"}
                  onChange={() => setDidAttend("not_attended")}
                  className="size-4 accent-amber-500"
                />
                <span>Yo‘q, men qatnashmadim / Hamkor kelmadi (Coin yechilmasin)</span>
              </label>
            </div>
          </div>

          {didAttend === "not_attended" ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              <ShieldAlert className="size-4 shrink-0 text-amber-400 mt-0.5" />
              <p>
                Siz qatnashmagan bo‘lsangiz yoki dars bo‘lmagan bo‘lsa, balansingizdan Coin
                yechilmaydi. Sessiya bekor qilinadi.
              </p>
            </div>
          ) : (
            <>
              {/* Rating */}
              <div>
                <Label className="text-sm font-medium">Hamkoringizni baholang:</Label>
                <div className="mt-2 flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      type="button"
                      aria-label={`${val} yulduz`}
                      onClick={() => setRating(val)}
                      className="p-1 transition-transform hover:scale-115 focus:outline-none"
                    >
                      <Star
                        className={
                          "size-7 " +
                          (val <= rating ? "fill-accent text-accent" : "text-muted-foreground/40")
                        }
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-sm font-semibold text-accent">{rating} / 5</span>
                </div>
              </div>

              {/* Comment */}
              <div>
                <Label htmlFor="review-comment" className="text-sm font-medium">
                  Fikr-mulohazangiz (Review):
                </Label>
                <Textarea
                  id="review-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Dars qanday o‘tdi? Hamkoringiz bilimlarini yaxshi tushuntirdimi?"
                  className="mt-1.5 min-h-[90px]"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Bekor qilish
          </Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy
              ? "Saqlanmoqda…"
              : didAttend === "not_attended"
                ? "Coin yechmasdan yakunlash"
                : "Baholashni yuborish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
