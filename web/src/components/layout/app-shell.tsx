import { Activity, BarChart3, Cog, LayoutDashboard, Radio, Server } from "lucide-react";
import { Suspense } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { RouteFallback } from "@/components/route-fallback";
import { useNow } from "@/hooks/use-now";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/", label: "Обзор", icon: LayoutDashboard, end: true },
  { to: "/stands/3", label: "Стенд 3", icon: Cog },
  { to: "/stands/5", label: "Стенд 5", icon: Cog },
  { to: "/mqtt", label: "MQTT-топики", icon: Radio },
  { to: "/analytics", label: "Аналитика", icon: BarChart3 },
];

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <NavLink to="/" className="flex items-center gap-2.5 rounded-lg px-2 py-1">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-accent/30 bg-accent/10 font-mono text-xs font-bold text-accent">
        CN
      </span>
      {compact ? null : (
        <span className="min-w-0">
          <span className="block text-sm font-semibold tracking-tight text-foreground">
            CNC Monitor
          </span>
          <span className="block text-[10px] uppercase tracking-[0.22em] text-muted">
            telemetry
          </span>
        </span>
      )}
    </NavLink>
  );
}

function NavItems({ compact = false }: { compact?: boolean }) {
  return (
    <>
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-2.5 rounded-lg text-sm font-medium transition",
                compact ? "shrink-0 px-3 py-1.5" : "px-2.5 py-2",
                isActive
                  ? "bg-accent/10 text-accent shadow-[inset_0_0_0_1px_rgba(34,211,238,0.16)]"
                  : "text-muted hover:bg-white/[0.04] hover:text-foreground",
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
            <span className={compact ? "whitespace-nowrap" : undefined}>{item.label}</span>
          </NavLink>
        );
      })}
    </>
  );
}

export function AppShell() {
  const now = useNow(1000);

  return (
    <div className="flex min-h-full">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-border/70 bg-panel/60 px-3 py-4 backdrop-blur-xl lg:flex">
        <Brand />
        <nav className="mt-8 flex flex-col gap-1">
          <NavItems />
        </nav>

        <div className="mt-auto space-y-3">
          <div className="rounded-xl border border-border/70 bg-black/20 p-3">
            <div className="flex items-center gap-2 text-xs text-muted">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
              </span>
              Опрос каждые 5 с
            </div>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
              <Server className="h-3.5 w-3.5" />
              <span className="font-mono">/api · 127.0.0.1:8080</span>
            </div>
          </div>
          <p className="px-1 text-[10px] leading-4 text-muted/60">CNC Telemetry · dashboard v0.1</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur-xl">
          <div className="flex h-14 items-center gap-3 px-4 lg:px-8">
            <div className="lg:hidden">
              <Brand compact />
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden items-center gap-1.5 text-[11px] text-muted sm:flex">
                <Activity className="h-3.5 w-3.5 text-ok" />
                live
              </span>
              <time className="font-mono text-xs tabular text-muted">{formatTime(now)}</time>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden">
            <NavItems compact />
          </nav>
        </header>

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1600px]">
            <Suspense fallback={<RouteFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
