import { Activity, Clock } from "lucide-react";
import type { LathePoint } from "@/api/queries";
import { RelativeTime } from "@/components/relative-time";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { Progress } from "@/components/ui/progress";
import { formatNumber } from "@/lib/format";
import { programTone } from "@/lib/status";
import { cn } from "@/lib/utils";

function findSignal(points: LathePoint[], signal: LathePoint["signal"]): LathePoint | undefined {
  return points.find((point) => point.signal === signal);
}

function Axis({ label, point }: { label: string; point?: LathePoint }) {
  return (
    <div className="rounded-lg border border-border/60 bg-black/20 px-3 py-2.5">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-0.5 font-mono text-2xl font-semibold tabular text-foreground">
        {point?.value_num !== null && point?.value_num !== undefined
          ? formatNumber(point.value_num, 3)
          : "—"}
        <span className="ml-1 text-[10px] font-normal text-muted">мм</span>
      </div>
    </div>
  );
}

export function DemoLatheCard({ points }: { points: LathePoint[] }) {
  const x = findSignal(points, "x");
  const z = findSignal(points, "z");
  const program = findSignal(points, "program");
  const percentPoint = findSignal(points, "program_percent");
  const percent = percentPoint?.value_num ?? 0;

  const updatedAt = points
    .map((point) => point.received_at)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];

  return (
    <Panel className="relative h-full overflow-hidden p-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-violet-400/70 via-border/40 to-transparent" />

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
            Демо-токарный
          </p>
          <div className="mt-1 flex items-center gap-2">
            <Activity className="h-4 w-4 text-violet-300" />
            <h2 className="text-sm font-medium text-foreground">Сигналы станка</h2>
          </div>
        </div>
        {updatedAt ? <RelativeTime value={updatedAt} className="text-[11px] text-muted" /> : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Axis label="X" point={x} />
        <Axis label="Z" point={z} />
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[10px] uppercase tracking-wider text-muted">Программа</span>
          <span className="font-mono text-xs tabular text-foreground/90">
            {percentPoint?.value_num !== null && percentPoint?.value_num !== undefined
              ? `${formatNumber(percentPoint.value_num, 0)}%`
              : "—"}
          </span>
        </div>
        <p
          className="mt-1 truncate font-mono text-sm text-foreground"
          title={program?.value_text || undefined}
        >
          {program?.value_text || "—"}
        </p>
        <Progress
          value={percent}
          tone={programTone(percent)}
          className="mt-2"
          barClassName={cn(percent > 0 && "bg-violet-400")}
        />
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          обновлено
        </span>
        <Badge tone="violet">polling 5s</Badge>
      </div>
    </Panel>
  );
}
