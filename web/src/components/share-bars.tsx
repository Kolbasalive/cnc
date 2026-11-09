import type { ShareItem } from "@/api/queries";
import { formatDuration, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

const COLORS = [
  "#22d3ee",
  "#a78bfa",
  "#34d399",
  "#fbbf24",
  "#fb7185",
  "#60a5fa",
  "#f472b6",
  "#94a3b8",
];

export function ShareBars({
  items,
  emptyText = "Нет данных за период",
  className,
}: {
  items: ShareItem[];
  emptyText?: string;
  className?: string;
}) {
  if (items.length === 0) {
    return <p className={cn("text-xs text-muted", className)}>{emptyText}</p>;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {items.map((item, index) => (
        <div
          key={`${item.label}-${item.seconds}`}
          title={`${formatDuration(item.seconds)} · ${formatPercent(item.percent)}`}
        >
          <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate text-foreground/90">{item.label}</span>
            <span className="shrink-0 tabular text-muted">{formatPercent(item.percent)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${Math.max(item.percent, 1.5)}%`,
                backgroundColor: COLORS[index % COLORS.length],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
