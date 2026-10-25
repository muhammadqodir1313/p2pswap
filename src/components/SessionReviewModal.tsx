import { useState } from "react";
import { Star, ShieldAlert, CheckCircle2, Flag } from "lucide-react";
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
import { db } from "@/lib/firebase";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { markUserAttended } from "@/lib/session-room";
import { callConfirmSessionAttendance } from "@/lib/functions";
import { ReportUserModal } from "@/components/ReportUserModal";

type SessionReviewModalProps = {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  isCalendarSlot?: boolean;
  userId: string;
  partnerId?: string;
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
  partnerId,
  isOwner,
  partnerName,
  skillName,
  onCompleted,
}: SessionReviewModalProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [didAttend, setDidAttend] = useState<"attended" | "not_attended">("attended");
  const [noShowReason, setNoShowReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  async function handleSubmit() {
    setBusy(true);
    try {
      if (didAttend === "not_attended") {
        // User reports no-show or didn't attend
        if (isCalendarSlot) {
          await updateDoc(doc(db, "calendar_slots", sessionId), { status: "cancelled" });
        } else {
          await callConfirmSessionAttendance({
            sessionId,
            didAttend: false,
            isNoShow: true,
            reason: noShowReason.trim() || "Hamkor darsga qatnashmadi (No-show)",
          });
        }

        toast.info(
          "No-show va qatnashilmaganlik qayd etildi. Balansingizdan hech qanday PeerPoint yechilmadi.",
        );
        onClose();
        onCompleted?.();
        return;
      }

      // Handle server-side confirmation & settlement FIRST
      if (isCalendarSlot) {
        await updateDoc(doc(db, "calendar_slots", sessionId), {
          status: "completed",
          [isOwner ? "owner_done" : "partner_done"]: true,
        });
      } else {
        const res = await callConfirmSessionAttendance({
          sessionId,
          didAttend: true,
        });

        if (res.bothConfirmed || res.settled) {
          toast.success(
            "Ikkala tomon ham darsni tasdiqladi! Server tranzaksiyasi orqali 1 PeerPoint adolatli o‘tkazildi.",
          );
        } else {
          toast.info(
            "Ishtirokingiz tasdiqlandi. Hamkor ham tasdiqlagan zahoti 1 PeerPoint server tomonidan hisob-kitob qilinadi.",
          );
        }
      }

      // Record local attended state & submit feedback ONLY after confirmation succeeds
      markUserAttended(sessionId, isOwner);

      // Save feedback in Firestore
      const feedbackId = `fb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await setDoc(doc(db, "feedback", feedbackId), {
        id: feedbackId,
        session_id: sessionId,
        user_id: userId,
        rating,
        comment: comment.trim() || "Mashg‘ulot muvaffaqiyatli o‘tdi.",
        created_at: new Date().toISOString(),
      });

      if (isCalendarSlot) {
        toast.success("Fikr-mulohazangiz va mashg‘ulotdagi ishtirokingiz qabul qilindi!");
      }

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
    <>
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
                  <span>Yo‘q, men qatnashmadim / Hamkor kelmadi (No-Show)</span>
                </label>
              </div>
            </div>

            {didAttend === "not_attended" ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                  <ShieldAlert className="size-4 shrink-0 text-amber-400 mt-0.5" />
                  <p>
                    Siz qatnashmagan bo‘lsangiz yoki dars bo‘lmagan bo‘lsa, balansingizdan Coin
                    yechilmaydi. Sessiya «E’tiroz / No-show» deb belgilanadi.
                  </p>
                </div>

                <div>
                  <Label htmlFor="no-show-reason" className="text-xs font-medium">
                    No-Show sababi (ixtiyoriy):
                  </Label>
                  <Textarea
                    id="no-show-reason"
                    value={noShowReason}
                    onChange={(e) => setNoShowReason(e.target.value)}
                    placeholder="Masalan: Hamkor dars boshlanishidan 15 daqiqa o‘tib ham chiqmadi..."
                    className="mt-1 text-xs min-h-[70px]"
                  />
                </div>
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

            {/* Abuse reporting button */}
            {partnerId && (
              <div className="pt-2 border-t border-border flex justify-between items-center">
                <span className="text-xs text-muted-foreground">
                  Muammo yoki qoidabuzarlik bormi?
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowReportModal(true)}
                  className="text-xs text-destructive hover:bg-destructive/10 h-7 px-2 gap-1"
                >
                  <Flag className="size-3" />
                  Hamkor ustidan shikoyat
                </Button>
              </div>
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
                  ? "No-Show qayd etish"
                  : "Baholashni yuborish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {partnerId && (
        <ReportUserModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          reportedUserId={partnerId}
          reportedUserName={partnerName}
          reporterUserId={userId}
          sessionId={sessionId}
        />
      )}
    </>
  );
}
