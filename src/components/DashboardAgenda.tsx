import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarDays, Coins, DoorOpen, Clock } from "lucide-react";

import {
  fetchUpcomingSlots,
  formatDayLabel,
  isSameDay,
  KIND_LABEL,
  slotColor,
  toTimeInput,
} from "@/lib/calendar";
import { fetchProfile, fullName, type ProfileWithSkills } from "@/lib/peerswap";

export function DashboardAgenda({
  userId,
  profiles,
}: {
  userId: string;
  profiles: ProfileWithSkills[];
}) {
  const slotsQuery = useQuery({
    queryKey: ["agenda", userId],
    queryFn: () => fetchUpcomingSlots(userId),
    enabled: !!userId,
  });

  const profileQuery = useQuery({
    queryKey: ["my-profile-coins", userId],
    queryFn: () => fetchProfile(userId),
    enabled: !!userId,
  });

  const slots = slotsQuery.data ?? [];
  const today = new Date();
  const todays = slots.filter((s) => isSameDay(new Date(s.starts_at), today));
  const upcoming = slots.filter((s) => s.partner_id && s.status !== "completed");
  const open = slots.filter(
    (s) => s.status === "open" && s.owner_id === userId && s.kind !== "personal",
  );
  const list = (todays.length ? todays : slots).slice(0, 5);

  const nameOf = (id: string | null) => {
    const p = profiles.find((x) => x.id === id);
    return p ? fullName(p) : "PeerSwap a’zosi";
  };

  const balance = profileQuery.data?.peercoins ?? 10;

  return (
    <section className="mt-10">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Mini icon={CalendarDays} label="Bugungi mashg‘ulotlar" value={todays.length} />
        <Mini icon={DoorOpen} label="Ochiq slotlarim" value={open.length} />
        <Mini icon={Clock} label="Yaqinlashayotgan mashg‘ulotlar" value={upcoming.length} />
        <Mini icon={Coins} label="PeerPoint balansi" value={balance} />
      </div>

      <div className="surface-card mt-4 p-5 rounded-xl border border-border">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Kun tartibingiz</h2>
            <p className="text-sm text-muted-foreground">
              {todays.length ? `Bugun, ${formatDayLabel(today)}` : "Yaqin kunlar"}
            </p>
          </div>
          <Link to="/calendar" className="text-sm font-medium text-primary hover:underline">
            To‘liq jadvalni ko‘rish →
          </Link>
        </div>

        {list.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Hozircha rejalar yo‘q.{" "}
            <Link to="/calendar" className="text-primary hover:underline">
              Kalendarda slot yarating
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {list.map((s) => {
              const other = s.owner_id === userId ? s.partner_id : s.owner_id;
              const st = new Date(s.starts_at);
              return (
                <li key={s.id} className="flex gap-4 items-center">
                  <div className="w-14 shrink-0 text-right text-sm">
                    <p className="font-semibold">{toTimeInput(st)}</p>
                    <p className="text-xs text-muted-foreground">
                      {toTimeInput(new Date(s.ends_at))}
                    </p>
                  </div>
                  <div
                    className={
                      "flex-1 rounded-lg border px-3 py-2 flex items-center justify-between gap-2 " +
                      slotColor(s)
                    }
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {s.skill} · <span className="opacity-80">{KIND_LABEL[s.kind]}</span>
                      </p>
                      <p className="text-xs opacity-80">
                        {s.partner_id
                          ? `Hamkor: ${nameOf(other)}`
                          : s.is_online
                            ? "Onlayn"
                            : "Oflayn"}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function Mini({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="surface-card p-4 rounded-xl border border-border">
      <Icon className="size-4 text-accent" />
      <p className="mt-2 text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
