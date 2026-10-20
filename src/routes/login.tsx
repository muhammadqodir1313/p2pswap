import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Kirish — PeerSwap" },
      { name: "description", content: "PeerSwap hisobingizga kiring va mos hamkor toping." },
      { property: "og:title", content: "Kirish — PeerSwap" },
      { property: "og:description", content: "PeerSwap hisobingizga kiring va mos hamkor toping." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, signInWithGoogle, signInWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/dashboard" });
  }, [user, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await signInWithEmail(email, password);
      toast.success("Xush kelibsiz!");
      navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes("user-not-found") ||
        msg.includes("wrong-password") ||
        msg.includes("invalid-credential")
      ) {
        toast.error("Email yoki parol noto‘g‘ri. Qayta urinib ko‘ring.");
      } else {
        toast.error("Kirishda xatolik yuz berdi. Iltimos, ma'lumotlarni tekshiring.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleLogin() {
    setGoogleBusy(true);
    try {
      await signInWithGoogle();
      toast.success("Google hisobi orqali muvaffaqiyatli kirildi!");
      navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("closed-by-user") && !msg.includes("popup-closed")) {
        toast.error("Google orqali kirishda xatolik yuz berdi.");
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
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Tizimga kirish</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bilim va ko‘nikmalaringizni boshqalar bilan almashing.
        </p>

        {/* Google sign-in button */}
        <div className="mt-6">
          <Button
            type="button"
            variant="outline"
            className="w-full flex items-center justify-center gap-3 py-5 border-border hover:bg-secondary font-medium transition-all"
            disabled={googleBusy || busy}
            onClick={handleGoogleLogin}
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
            {googleBusy ? "Google bilan ulanmoqda…" : "Google bilan kirish"}
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

        <form onSubmit={onSubmit} className="space-y-4">
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" className="w-full gap-2 font-medium" disabled={busy || googleBusy}>
            <LogIn className="w-4 h-4" />
            {busy ? "Kirilmoqda…" : "Kirish"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Hisobingiz yo‘qmi?{" "}
          <Link to="/signup" className="text-primary font-medium hover:underline">
            Ro‘yxatdan o‘tish
          </Link>
        </p>
      </div>
    </div>
  );
}
