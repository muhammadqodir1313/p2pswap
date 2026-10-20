import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";

import { AppShell } from "@/components/AppHeader";
import { SkillTags } from "@/components/SkillTags";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { db, handleFirestoreError, OperationType } from "@/lib/firebase";
import { useAuth, useRequireAuth } from "@/lib/auth";
import { fetchProfile, type SkillKind } from "@/lib/peerswap";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Mening profilim — PeerSwap" },
      { name: "description", content: "PeerSwap profilingiz va ko‘nikmalaringizni tahrirlang." },
      { property: "og:title", content: "Mening profilim — PeerSwap" },
      {
        property: "og:description",
        content: "PeerSwap profilingiz va ko‘nikmalaringizni tahrirlang.",
      },
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
    queryKey: ["profile", user?.uid],
    queryFn: () => fetchProfile(user!.uid),
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
    const docPath = `profiles/${user!.uid}`;
    try {
      const field = kind === "teach" ? "teach" : "learn";
      await updateDoc(doc(db, "profiles", user!.uid), {
        [field]: arrayUnion(skill),
      });
      if (kind === "teach") setTeachInput("");
      else setLearnInput("");
      profileQuery.refetch();
      toast.success("Ko‘nikma qo‘shildi");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, docPath);
    }
  }

  async function removeSkill(kind: SkillKind, skill: string) {
    const docPath = `profiles/${user!.uid}`;
    try {
      const field = kind === "teach" ? "teach" : "learn";
      await updateDoc(doc(db, "profiles", user!.uid), {
        [field]: arrayRemove(skill),
      });
      profileQuery.refetch();
      toast.success("Ko‘nikma o‘chirildi");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, docPath);
    }
  }

  async function save() {
    setSaving(true);
    const docPath = `profiles/${user!.uid}`;
    try {
      await updateDoc(doc(db, "profiles", user!.uid), {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        bio: bio.trim(),
        updated_at: new Date().toISOString(),
      });
      toast.success("Profil saqlandi");
      profileQuery.refetch();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, docPath);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Mening profilim</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Mos hamkor topishda ko‘nikmalaringiz muhim — ularni yangilab turing.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="surface-card p-6 rounded-xl border border-border">
          <h2 className="font-semibold text-lg">Shaxsiy ma’lumotlar</h2>
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="first">Ism</Label>
                <Input
                  id="first"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ali"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last">Familiya</Label>
                <Input
                  id="last"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Valiyev"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">O‘zingiz haqingizda</Label>
              <Textarea
                id="bio"
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tajribangiz, maqsadlaringiz va qiziqishlaringiz haqida qisqacha…"
              />
            </div>

            <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
              {saving ? "Saqlanmoqda…" : "O‘zgarishlarni saqlash"}
            </Button>
          </div>
        </section>

        <section className="space-y-6">
          <div className="surface-card p-6 rounded-xl border border-border">
            <h2 className="font-semibold text-lg">O‘rgata olaman (Teach)</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Boshqalarga o‘rgatishga tayyor bo‘lgan bilim va tajribalaringiz.
            </p>
            <div className="mt-3">
              <SkillTags
                skills={profile?.teach ?? []}
                kind="teach"
                onRemove={(s) => removeSkill("teach", s)}
              />
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addSkill("teach", teachInput);
              }}
              className="mt-4 flex gap-2"
            >
              <Input
                placeholder="Masalan: Python, Figma, Ingliz tili…"
                value={teachInput}
                onChange={(e) => setTeachInput(e.target.value)}
              />
              <Button type="submit" variant="secondary">
                Qo‘shish
              </Button>
            </form>
          </div>

          <div className="surface-card p-6 rounded-xl border border-border">
            <h2 className="font-semibold text-lg">O‘rganmoqchiman (Learn)</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Qaysi soha yoki vositalarni o‘rganishni istaysiz?
            </p>
            <div className="mt-3">
              <SkillTags
                skills={profile?.learn ?? []}
                kind="learn"
                onRemove={(s) => removeSkill("learn", s)}
              />
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addSkill("learn", learnInput);
              }}
              className="mt-4 flex gap-2"
            >
              <Input
                placeholder="Masalan: Docker, Prompt Engineering…"
                value={learnInput}
                onChange={(e) => setLearnInput(e.target.value)}
              />
              <Button type="submit" variant="secondary">
                Qo‘shish
              </Button>
            </form>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
