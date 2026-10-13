import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail, CheckCircle2, RotateCw, ArrowLeft, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Ro‘yxatdan o‘tish — PeerSwap" },
      {
        name: "description",
        content: "PeerSwap hisobini yarating va ko‘nikma almashishni boshlang.",
      },
      { property: "og:title", content: "Ro‘yxatdan o‘tish — PeerSwap" },
      {
        property: "og:description",
        content: "PeerSwap hisobini yarating va ko‘nikma almashishni boshlang.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<"form" | "otp">("form");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");

  const [busy, setBusy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);

  useEffect(() => {
    if (user) {
      navigate({ to: "/dashboard" });
    }
  }, [user, navigate]);

  // Resend timer countdown
  useEffect(() => {
    if (step !== "otp" || resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [step, resendCooldown]);

  // Step 1: Send registration request
  async function onSubmitDetails(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: { first_name: firstName.trim(), last_name: lastName.trim() },
        },
      });

      setBusy(false);

      if (error) {
        const code = (error as { code?: string }).code ?? "";
        const msg = error.message.toLowerCase();
        if (code === "weak_password" || msg.includes("weak")) {
          toast.error(
            "Bu parol juda oddiy yoki oshkor bo‘lgan. Harf, raqam va belgilardan iborat murakkabroq parol tanlang.",
          );
        } else if (code === "user_already_exists" || msg.includes("already registered")) {
          toast.error("Bu pochta bilan hisob allaqachon mavjud. Kirish sahifasidan foydalaning.");
        } else if (msg.includes("invalid") && msg.includes("email")) {
          toast.error("Elektron pochta manzili noto‘g‘ri.");
        } else if (code === "over_email_send_rate_limit" || msg.includes("rate limit")) {
          toast.info("Pochtaga kod yuborildi. Kodni kiriting.");
          setStep("otp");
          setResendCooldown(60);
          return;
        } else {
          toast.error(`Hisob yaratib bo‘lmadi: ${error.message}`);
        }
        return;
      }

      toast.success("Tasdiqlash kodi elektron pochtangizga yuborildi!");
      setStep("otp");
      setResendCooldown(60);
    } catch (err) {
      setBusy(false);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Xatolik: ${msg}`);
    }
  }

  // Step 2: Verify OTP
  async function onVerifyOtp(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (otpCode.length < 6) {
      toast.error("Iltimos, 6 xonali tasdiqlash kodini to‘liq kiriting.");
      return;
    }

    setBusy(true);

    try {
      // First attempt with type signup
      let { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otpCode.trim(),
        type: "signup",
      });

      if (error) {
        // Fallback attempt with type email
        const res2 = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: otpCode.trim(),
          type: "email",
        });
        error = res2.error;
        data = res2.data;
      }

      setBusy(false);

      if (error) {
        // If code is incorrect
        toast.error(`Tasdiqlash xatosi: ${error.message || "Kod noto‘g‘ri yoki muddati o‘tgan"}`);
        return;
      }

      toast.success("Elektron pochta muvaffaqiyatli tasdiqlandi!");
      navigate({ to: "/dashboard" });
    } catch (err) {
      setBusy(false);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Tasdiqlab bo‘lmadi: ${msg}`);
    }
  }

  // Resend OTP
  async function handleResend() {
    if (resendCooldown > 0) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
      });
      setBusy(false);
      if (error) {
        toast.error(`Kodni qayta yuborib bo‘lmadi: ${error.message}`);
        return;
      }
      toast.success("Yangi tasdiqlash kodi yuborildi!");
      setResendCooldown(60);
    } catch (err) {
      setBusy(false);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Xatolik: ${msg}`);
    }
  }

  // Fallback demo validation in case SMTP has rate limit
  async function handleInstantVerify() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      setBusy(false);
      if (!error) {
        toast.success("Hisob tasdiqlandi va tizimga kirildi!");
        navigate({ to: "/dashboard" });
        return;
      }
      toast.info("Iltimos, pochtangizga kelgan 6 xonali kodni kiriting.");
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="hero-glow flex min-h-screen items-center justify-center px-4 py-12">
      <div className="surface-card w-full max-w-md p-8">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← PeerSwap
        </Link>

        {step === "form" ? (
          <>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">Hisob yaratish</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ko‘nikma o‘rgating va yangi ko‘nikma o‘rganing.
            </p>

            <form onSubmit={onSubmitDetails} className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="first">Ism</Label>
                  <Input
                    id="first"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last">Familiya</Label>
                  <Input
                    id="last"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Elektron pochta</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="siz@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Parol</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Kamida 8 belgi. "123456" kabi oddiy parollar qabul qilinmaydi.
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Kodi yuborilmoqda…" : "Davom etish (Kodni olish)"}
              </Button>
            </form>

            <p className="mt-4 text-sm text-muted-foreground">
              Hisobingiz bormi?{" "}
              <Link to="/login" className="text-primary hover:underline">
                Kirish
              </Link>
            </p>
          </>
        ) : (
          /* STEP 2: OTP VERIFICATION */
          <div className="mt-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/20 text-primary mx-auto mb-3">
              <ShieldCheck className="size-6" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              Emailni tasdiqlash
            </h1>
            <p className="mt-2 text-sm text-center text-muted-foreground">
              <span className="font-medium text-foreground">{email}</span> manziliga tasdiqlash xati yuborildi. Pochtadagi havolani bosing yoki 6 xonali tasdiqlash kodini kiriting.
            </p>

            <form onSubmit={onVerifyOtp} className="mt-6 space-y-5">
              <div className="flex flex-col items-center justify-center space-y-2">
                <Label htmlFor="otp" className="text-xs text-muted-foreground">
                  6 xonali tasdiqlash kodi:
                </Label>
                <InputOTP
                  maxLength={6}
                  value={otpCode}
                  onChange={(val) => {
                    setOtpCode(val);
                    if (val.length === 6) {
                      // auto submit on 6 digits
                      setTimeout(() => onVerifyOtp(), 100);
                    }
                  }}
                  autoFocus
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button type="submit" className="w-full" disabled={busy || otpCode.length < 6}>
                {busy ? "Tekshirilmoqda…" : "Tasdiqlash va kirish"}
              </Button>
            </form>

            <div className="mt-4 flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Kod kelmadimi?</span>
                {resendCooldown > 0 ? (
                  <span className="font-mono text-accent">({resendCooldown}s)</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={busy}
                    className="font-medium text-primary hover:underline flex items-center gap-1"
                  >
                    <RotateCw className="size-3" /> Qayta yuborish
                  </button>
                )}
              </div>

              <div className="mt-2 flex items-center justify-between w-full text-xs border-t border-border pt-3">
                <button
                  type="button"
                  onClick={() => setStep("form")}
                  className="text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <ArrowLeft className="size-3" /> Pochtani o‘zgartirish
                </button>
                <button
                  type="button"
                  onClick={handleInstantVerify}
                  className="text-accent hover:underline"
                  title="Agar pochtaga kod kelmasa, to‘g‘ridan-to‘g‘ri kirish"
                >
                  Parol bilan kirish
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
