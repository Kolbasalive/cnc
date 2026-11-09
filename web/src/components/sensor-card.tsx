import { Droplets, Thermometer } from "lucide-react";
import { RelativeTime } from "@/components/relative-time";
import { Panel } from "@/components/ui/panel";
import { formatNumber } from "@/lib/format";
import type { SensorGroup } from "@/lib/sensors";

export function SensorCard({ group }: { group: SensorGroup }) {
  const temperature = group.temp?.value;
  const humidity = group.humidity?.value;

  return (
    <Panel className="p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium text-foreground/90">{group.label}</p>
        {group.updatedAt ? (
          <RelativeTime value={group.updatedAt} className="shrink-0 text-[10px] text-muted" />
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border/60 bg-black/20 px-2.5 py-2">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted">
            <Thermometer className="h-3 w-3 text-amber-300" />
            темп.
          </div>
          <div className="mt-1 font-mono text-lg font-semibold tabular text-foreground">
            {temperature !== undefined ? formatNumber(temperature, 1) : "—"}
            <span className="ml-0.5 text-[11px] font-normal text-muted">°C</span>
          </div>
        </div>

        <div className="rounded-lg border border-border/60 bg-black/20 px-2.5 py-2">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted">
            <Droplets className="h-3 w-3 text-sky-300" />
            влажн.
          </div>
          <div className="mt-1 font-mono text-lg font-semibold tabular text-foreground">
            {humidity !== undefined ? formatNumber(humidity, 1) : "—"}
            <span className="ml-0.5 text-[11px] font-normal text-muted">%</span>
          </div>
        </div>
      </div>
    </Panel>
  );
}
