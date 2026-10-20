import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const { user, signUpWithEmail, signInWithGoogle } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    if (user) {
      navigate({ to: "/dashboard" });
    }
  }, [user, navigate]);

  async function onSubmitDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim()) {
      toast.error("Iltimos, ismingizni kiriting.");
      return;
    }
    if (password.length < 6) {
      toast.error("Parol kamida 6 ta belgidan iborat bo‘lishi lozim.");
      return;
    }

    setBusy(true);
    try {
      await signUpWithEmail(email, password, firstName.trim(), lastName.trim());
      toast.success("Hisobingiz muvaffaqiyatli yaratildi!");
      navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("email-already-in-use")) {
        toast.error(
          "Ushbu email manzili bilan allaqachon hisob ochilgan. Kirish sahifasidan foydalaning.",
        );
      } else if (msg.includes("weak-password")) {
        toast.error("Parol juda oddiy. Kamida 6 ta harf va raqamdan iborat parol kiriting.");
      } else {
        toast.error("Hisob ochishda xatolik yuz berdi. Qayta urinib ko‘ring.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleSignUp() {
    setGoogleBusy(true);
    try {
      await signInWithGoogle();
      toast.success("Google orqali muvaffaqiyatli ulandingiz!");
      navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("closed-by-user") && !msg.includes("popup-closed")) {
        toast.error("Google orqali ro‘yxatdan o‘tishda xatolik yuz berdi.");
      }
    } finally {
      setGoogleBusy(false);
    }
  }

  return (
    <div className="hero-glow flex min-h-screen items-center justify-center px-4 py-12">
      <div className="surface-card w-full max-w-md p-8 shadow-xl rounded-2xl border border-border">
        <Link to="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          ← PeerSwap Asosiy sahifa
        </Link>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Ro‘yxatdan o‘tish</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O‘rganmoqchi va o‘rgatmoqchi bo‘lgan ko‘nikmalaringizni ulashing.
        </p>

        {/* Google sign-in button */}
        <div className="mt-6">
          <Button
            type="button"
            variant="outline"
            className="w-full flex items-center justify-center gap-3 py-5 border-border hover:bg-secondary font-medium transition-all"
            disabled={googleBusy || busy}
            onClick={handleGoogleSignUp}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            {googleBusy ? "Google bilan ulanmoqda…" : "Google orqali boshlash"}
          </Button>
        </div>

        <div className="relative my-6 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <span className="relative bg-background px-3 text-xs text-muted-foreground uppercase">
            yoki email orqali
          </span>
        </div>

        <form onSubmit={onSubmitDetails} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="firstName">Ism</Label>
              <Input
                id="firstName"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Aziz"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Familiya</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Rahimov"
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
              placeholder="aziz@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Parol (kamida 6 ta belgi)</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <Button type="submit" className="w-full gap-2 font-medium" disabled={busy || googleBusy}>
            <UserPlus className="w-4 h-4" />
            {busy ? "Hisob yaratilmoqda…" : "Ro‘yxatdan o‘tish"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Hisobingiz bormi?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Kirish
          </Link>
        </p>
      </div>
    </div>
  );
}
