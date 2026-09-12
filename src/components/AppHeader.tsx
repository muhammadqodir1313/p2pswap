import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Repeat2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

const links = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/matches", label: "Find Match" },
  { to: "/sessions", label: "My Sessions" },
  { to: "/profile", label: "Profile" },
  { to: "/plans", label: "Plans" },
] as const;

export function AppHeader() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <Link to="/dashboard" className="flex items-center gap-2 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-gradient text-primary-foreground">
            <Repeat2 className="size-4" />
          </span>
          <span className="text-lg tracking-tight">PeerSwap</span>
        </Link>

        <nav className="flex flex-1 flex-wrap items-center gap-1 text-sm">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-secondary text-foreground" }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await signOut();
            navigate({ to: "/" });
          }}
        >
          <LogOut className="size-4" />
          Logout
        </Button>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
