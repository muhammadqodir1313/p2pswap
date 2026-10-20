import { useState } from "react";
import { ShieldAlert, AlertTriangle, Send } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { callReportUser } from "@/lib/functions";
import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";

export type ReportUserModalProps = {
  isOpen: boolean;
  onClose: () => void;
  reportedUserId: string;
  reportedUserName: string;
  reporterUserId: string;
  sessionId?: string;
};

const REPORT_REASONS = [
  {
    id: "no_show",
    label: "Mashg‘ulotga kelmadi (No-show)",
    desc: "Rejalashtirilgan vaqtda kelmadi yoki ogohlantirishsiz qatnashmadi.",
  },
  {
    id: "inappropriate_behavior",
    label: "Nomaqbul xulq-atvor yoki muomala",
    desc: "Qo‘pollik, haqorat yoki professional bo‘lmagan xatti-harakat.",
  },
  {
    id: "cheating",
    label: "Ballar yoki tizimni aldashga urinish",
    desc: "Dars o‘tmasdan ball talab qilish yoki kelishuvni buzish.",
  },
  {
    id: "spam",
    label: "Spam yoki begona reklama",
    desc: "Mavzuga aloqasiz xabarlar, mahsulot yoki xizmatlarni targ‘ib qilish.",
  },
  {
    id: "other",
    label: "Boshqa sabab",
    desc: "Yuqoridagi toifalarga kirmagan qoidabuzarlik.",
  },
] as const;

export function ReportUserModal({
  isOpen,
  onClose,
  reportedUserId,
  reportedUserName,
  reporterUserId,
  sessionId,
}: ReportUserModalProps) {
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number]["id"]>("no_show");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!details.trim()) {
      toast.error("Iltimos, vaziyat bo‘yicha qisqacha ma’lumot yozing.");
      return;
    }

    setSubmitting(true);
    try {
      // First try callable Cloud Function
      try {
        await callReportUser({
          reportedUserId,
          sessionId,
          reason,
          details: details.trim(),
        });
      } catch {
        // Fallback: direct write to reports collection (rules enforce reporter_id == request.auth.uid)
        const reportId = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await setDoc(doc(db, "reports", reportId), {
          id: reportId,
          reporter_id: reporterUserId,
          reported_user_id: reportedUserId,
          session_id: sessionId || null,
          reason,
          details: details.trim(),
          status: "pending",
          created_at: new Date().toISOString(),
        });
      }

      toast.success(
        "Shikoyatingiz qabul qilindi. Ma’murlar holatni ko‘rib chiqib, chora ko‘rishadi.",
      );
      setDetails("");
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Shikoyatni yuborishda xatolik: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="size-5" />
            Foydalanuvchi ustidan shikoyat
          </DialogTitle>
          <DialogDescription>
            <span className="font-semibold text-foreground">{reportedUserName}</span> hisobiga oid
            qoidabuzarlik haqida xabar bering. Ma’lumotlar maxfiy saqlanadi va faqat ma’muriyat
            ko‘ra oladi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-sm font-semibold">Qoidabuzarlik turi:</Label>
            <RadioGroup value={reason} onValueChange={setReason} className="mt-2 space-y-2">
              {REPORT_REASONS.map((r) => (
                <label
                  key={r.id}
                  className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-2.5 text-xs transition-colors hover:bg-muted/40 has-[[data-state=checked]]:border-destructive/60 has-[[data-state=checked]]:bg-destructive/5"
                >
                  <RadioGroupItem value={r.id} id={r.id} className="mt-0.5" />
                  <div>
                    <span className="font-medium text-foreground">{r.label}</span>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{r.desc}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="report-details" className="text-sm font-semibold">
              Batafsil izoh (Majburiy):
            </Label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Vaziyatni qisqacha bayon qiling: nima sodir bo‘ldi, vaqt yoki boshqa dalillar..."
              className="mt-1.5 min-h-[90px] text-xs"
              maxLength={1000}
            />
            <p className="mt-1 text-right text-[11px] text-muted-foreground">
              {details.length}/1000 belgi
            </p>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 text-[11px] text-amber-300">
            <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-400" />
            <p>
              Yolg‘on yoki asossiz shikoyat yuborish akkauntingiz reytingiga salbiy ta’sir
              ko‘rsatishi mumkin.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Bekor qilish
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={submitting || !details.trim()}
            className="gap-1.5"
          >
            <Send className="size-3.5" />
            {submitting ? "Yuborilmoqda…" : "Shikoyatni yuborish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
