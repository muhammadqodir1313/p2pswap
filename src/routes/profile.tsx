import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppHeader";
import { SkillTags } from "@/components/SkillTags";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useRequireAuth } from "@/lib/auth";
import { fetchProfile, type SkillKind } from "@/lib/peerswap";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Mening profilim — PeerSwap" },
      { name: "description", content: "PeerSwap profilingiz va ko‘nikmalaringizni tahrirlang." },
      { property: "og:title", content: "Mening profilim — PeerSwap" },
      { property: "og:description", content: "PeerSwap profilingiz va ko‘nikmalaringizni tahrirlang." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useRequireAuth();
  const { loading } = useAuth();

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => fetchProfile(user!.id),
    enabled: !!user,
  });

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bio, setBio] = useState("");
  const [teachInput, setTeachInput] = useState("");
  const [learnInput, setLearnInput] = useState("");
  const [saving, setSaving] = useState(false);

  const profile = profileQuery.data;

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name);
      setLastName(profile.last_name);
      setBio(profile.bio);
    }
  }, [profile]);

  if (loading || !user) return null;

  async function addSkill(kind: SkillKind, value: string) {
    const skill = value.trim();
    if (!skill) return;
    const { error } = await supabase.from("user_skills").insert({ user_id: user!.id, skill, kind });
    if (error && !error.message.includes("duplicate")) {
      toast.error(error.message);
      return;
    }
    if (kind === "teach") setTeachInput("");
    else setLearnInput("");
    profileQuery.refetch();
  }

  async function removeSkill(kind: SkillKind, skill: string) {
    const { error } = await supabase
      .from("user_skills")
      .delete()
      .eq("user_id", user!.id)
      .eq("kind", kind)
      .eq("skill", skill);
    if (error) {
      toast.error(error.message);
      return;
    }
    profileQuery.refetch();
  }

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ first_name: firstName, last_name: lastName, bio })
      .eq("id", user!.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profil saqlandi");
    profileQuery.refetch();
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Mening profilim</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Mos hamkor topishda ko‘nikmalaringiz muhim — ularni yangilab turing.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="surface-card p-6">
          <h2 className="font-semibold">Ma’lumotlar</h2>
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="first">Ism</Label>
                <Input id="first" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last">Familiya</Label>
                <Input id="last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Qisqacha ma’lumot</Label>
              <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} />
            </div>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saqlanmoqda…" : "O‘zgarishlarni saqlash"}
            </Button>
          </div>
        </section>

        <section className="surface-card p-6">
          <h2 className="font-semibold">Ko‘nikmalar</h2>

          <div className="mt-4 space-y-2">
            <Label htmlFor="teach">Men o‘rgata oladigan ko‘nikmalar</Label>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addSkill("teach", teachInput);
              }}
            >
              <Input
                id="teach"
                value={teachInput}
                onChange={(e) => setTeachInput(e.target.value)}
                placeholder="Masalan, React"
              />
              <Button type="submit" variant="secondary">
                Qo‘shish
              </Button>
            </form>
            <div className="pt-2">
              <SkillTags
                skills={profile?.teach ?? []}
                tone="teach"
                onRemove={(skill) => removeSkill("teach", skill)}
              />
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <Label htmlFor="learn">Men o‘rganmoqchi bo‘lgan ko‘nikmalar</Label>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addSkill("learn", learnInput);
              }}
            >
              <Input
                id="learn"
                value={learnInput}
                onChange={(e) => setLearnInput(e.target.value)}
                placeholder="Masalan, SQL"
              />
              <Button type="submit" variant="secondary">
                Qo‘shish
              </Button>
            </form>
            <div className="pt-2">
              <SkillTags
                skills={profile?.learn ?? []}
                tone="learn"
                onRemove={(skill) => removeSkill("learn", skill)}
              />
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
