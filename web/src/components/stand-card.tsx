import { AlertTriangle, CheckCircle2, ChevronRight, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import type { Snapshot } from "@/api/queries";
import { RelativeTime } from "@/components/relative-time";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { Progress } from "@/components/ui/progress";
import { formatNumber, parseDuration } from "@/lib/format";
import {
  isSnapshotStale,
  modeTone,
  programTone,
  standName,
  statusTone,
  type Tone,
} from "@/lib/status";
import { cn } from "@/lib/utils";

const ACCENT: Record<Tone, string> = {
  ok: "from-emerald-400/70",
  warn: "from-amber-400/70",
  danger: "from-rose-400/70",
  info: "from-sky-400/70",
  violet: "from-violet-400/70",
  neutral: "from-slate-400/50",
};

function AxisValue({
  channel,
  axis,
  position,
  showChannel,
}: {
  channel: number;
  axis: string;
  position: number;
  showChannel: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-black/20 px-2.5 py-2">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted">
        {showChannel ? `К${channel} · ` : ""}
        {axis}
      </div>
      <div className="mt-0.5 font-mono text-base font-semibold tabular text-foreground">
        {formatNumber(position, 3)}
        <span className="ml-1 text-[10px] font-normal text-muted">мм</span>
      </div>
    </div>
  );
}

export function StandCard({ snapshot }: { snapshot: Snapshot }) {
  const stale = isSnapshotStale(snapshot);
  const status = statusTone(snapshot.status);
  const accent = stale ? "danger" : status;
  const channels = new Set(snapshot.axes.map((axis) => axis.channel));
  const axes = [...snapshot.axes]
    .sort((a, b) => a.channel - b.channel || a.axis.localeCompare(b.axis))
    .slice(0, 6);
  const hiddenAxes = snapshot.axes.length - axes.length;
  const percent = snapshot.program_percent ?? 0;
  const runtime = parseDuration(snapshot.channel_runtime_current);

  return (
    <Link
      to={`/stands/${snapshot.stand_id}`}
      className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
    >
      <Panel className="relative h-full overflow-hidden p-4 transition duration-200 group-hover:border-accent/35 group-hover:bg-panel">
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r via-border/40 to-transparent",
            ACCENT[accent],
          )}
        />

        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
              {standName(snapshot.stand_id)}
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-semibold leading-none tracking-tight text-foreground">
                {snapshot.stand_id}
              </span>
              <span className="text-[11px] text-muted">stand id</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Badge tone={snapshot.online && !stale ? "ok" : "danger"} dot>
              {snapshot.online && !stale ? "online" : "offline"}
            </Badge>
            <RelativeTime value={snapshot.received_at} className="text-[11px] text-muted" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge tone={status}>{snapshot.status || "нет статуса"}</Badge>
          <Badge tone={modeTone(snapshot.mode)}>{snapshot.mode || "режим —"}</Badge>
          {snapshot.errors.length > 0 ? (
            <Badge tone="danger">
              <AlertTriangle className="h-3 w-3" />
              {snapshot.errors.length}
            </Badge>
          ) : (
            <Badge tone="ok">
              <CheckCircle2 className="h-3 w-3" />
              без ошибок
            </Badge>
          )}
          <ChevronRight className="ml-auto h-4 w-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-accent" />
        </div>

        <div className="mt-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[10px] uppercase tracking-wider text-muted">Программа</span>
            <span className="font-mono text-xs tabular text-foreground/90">
              {snapshot.program_percent !== null && snapshot.program_percent !== undefined
                ? `${snapshot.program_percent}%`
                : "—"}
            </span>
          </div>
          <p
            className="mt-1 truncate font-mono text-sm text-foreground"
            title={snapshot.program_name || undefined}
          >
            {snapshot.program_name || "—"}
          </p>
          <Progress value={percent} tone={programTone(snapshot.program_percent)} className="mt-2" />
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {snapshot.program_time || "—"}
            </span>
            <span>{runtime !== null ? `канал ${snapshot.channel_runtime_current}` : ""}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {axes.map((axis) => (
            <AxisValue
              key={`${axis.channel}-${axis.axis}`}
              channel={axis.channel}
              axis={axis.axis}
              position={axis.position_mm}
              showChannel={channels.size > 1}
            />
          ))}
          {hiddenAxes > 0 ? (
            <div className="col-span-2 text-[11px] text-muted">ещё {hiddenAxes} осей</div>
          ) : null}
          {axes.length === 0 ? (
            <div className="col-span-2 rounded-lg border border-dashed border-border/70 px-2.5 py-2 text-[11px] text-muted">
              Позиции осей не переданы
            </div>
          ) : null}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3 text-[11px] text-muted">
          <span className="truncate">
            ядро:{" "}
            <span className="font-mono text-foreground/70">
              {snapshot.core_runtime_current || "—"}
            </span>
          </span>
          {stale ? <span className="text-rose-300">данные устарели</span> : null}
        </div>
      </Panel>
    </Link>
  );
}
