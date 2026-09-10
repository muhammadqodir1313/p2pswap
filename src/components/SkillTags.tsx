import { X } from "lucide-react";

export function SkillTags({
  skills,
  tone = "teach",
  onRemove,
}: {
  skills: string[];
  tone?: "teach" | "learn";
  onRemove?: (skill: string) => void;
}) {
  if (skills.length === 0) {
    return <p className="text-sm text-muted-foreground">No skills added yet.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {skills.map((skill) => (
        <span
          key={skill}
          className={
            "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium " +
            (tone === "teach"
              ? "border-accent/40 bg-accent/10 text-accent"
              : "border-primary/40 bg-primary/10 text-primary")
          }
        >
          {skill}
          {onRemove ? (
            <button
              type="button"
              aria-label={`Remove ${skill}`}
              onClick={() => onRemove(skill)}
              className="opacity-70 transition-opacity hover:opacity-100"
            >
              <X className="size-3" />
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
}
