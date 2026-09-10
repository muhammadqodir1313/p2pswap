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
      { title: "My Profile — PeerSwap" },
      { name: "description", content: "Edit your PeerSwap profile and the skills you teach and want to learn." },
      { property: "og:title", content: "My Profile — PeerSwap" },
      { property: "og:description", content: "Edit your profile and skills on PeerSwap." },
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
    toast.success("Profile saved");
    profileQuery.refetch();
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">My Profile</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your skills power the matching — keep them up to date.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="surface-card p-6">
          <h2 className="font-semibold">Details</h2>
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="first">First name</Label>
                <Input id="first" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last">Last name</Label>
                <Input id="last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Short bio</Label>
              <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} />
            </div>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </section>

        <section className="surface-card p-6">
          <h2 className="font-semibold">Skills</h2>

          <div className="mt-4 space-y-2">
            <Label htmlFor="teach">Skills I Can Teach</Label>
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
                placeholder="e.g. React"
              />
              <Button type="submit" variant="secondary">
                Add
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
            <Label htmlFor="learn">Skills I Want To Learn</Label>
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
                placeholder="e.g. SQL"
              />
              <Button type="submit" variant="secondary">
                Add
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
