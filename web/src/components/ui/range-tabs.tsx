import { RANGE_OPTIONS, type RangeKey } from "@/lib/range";
import { cn } from "@/lib/utils";

export function RangeTabs({
  value,
  onChange,
  className,
}: {
  value: RangeKey;
  onChange: (value: RangeKey) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex rounded-lg border border-border bg-panel p-0.5 shadow-sm",
        className,
      )}
      role="tablist"
      aria-label="Период"
    >
      {RANGE_OPTIONS.map((option) => (
        <button
          key={option.key}
          type="button"
          role="tab"
          aria-selected={value === option.key}
          onClick={() => onChange(option.key)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition",
            value === option.key
              ? "bg-accent/15 text-accent shadow-[inset_0_0_0_1px_rgba(34,211,238,0.25)]"
              : "text-muted hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
