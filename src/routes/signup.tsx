import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Ro‘yxatdan o‘tish — PeerSwap" },
      { name: "description", content: "PeerSwap hisobini yarating va ko‘nikma almashishni boshlang." },
      { property: "og:title", content: "Ro‘yxatdan o‘tish — PeerSwap" },
      { property: "og:description", content: "PeerSwap hisobini yarating va ko‘nikma almashishni boshlang." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/dashboard" });
  }, [user, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { first_name: firstName, last_name: lastName },
      },
    });
    setBusy(false);
    if (error) {
      const code = (error as { code?: string }).code ?? "";
      const msg = error.message.toLowerCase();
      if (code === "weak_password" || msg.includes("weak")) {
        toast.error("Bu parol juda oddiy yoki oshkor bo‘lgan. Harf, raqam va belgilardan iborat murakkabroq parol tanlang.");
      } else if (code === "user_already_exists" || msg.includes("already registered")) {
        toast.error("Bu pochta bilan hisob allaqachon mavjud. Kirish sahifasidan foydalaning.");
      } else if (msg.includes("invalid") && msg.includes("email")) {
        toast.error("Elektron pochta manzili noto‘g‘ri.");
      } else if (code === "over_email_send_rate_limit" || msg.includes("rate limit")) {
        toast.error("Juda ko‘p urinish. Birozdan so‘ng qayta urinib ko‘ring.");
      } else {
        toast.error(`Hisob yaratib bo‘lmadi: ${error.message}`);
      }
      return;
    }
    toast.success("Hisob yaratildi!");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="hero-glow flex min-h-screen items-center justify-center px-4 py-12">
      <div className="surface-card w-full max-w-md p-8">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← PeerSwap
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Hisob yaratish</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ko‘nikma o‘rgating va yangi ko‘nikma o‘rganing.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="first">Ism</Label>
              <Input id="first" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last">Familiya</Label>
              <Input id="last" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
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
            <p className="text-xs text-muted-foreground">Kamida 8 belgi. "123456" kabi oddiy parollar qabul qilinmaydi.</p>

          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Yaratilmoqda…" : "Almashishni boshlash"}
          </Button>
        </form>

        <p className="mt-4 text-sm text-muted-foreground">
          Hisobingiz bormi?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Kirish
          </Link>
        </p>
      </div>
    </div>
  );
}
