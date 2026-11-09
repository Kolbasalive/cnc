import { clamp } from "@/lib/format";
import type { Tone } from "@/lib/status";
import { cn } from "@/lib/utils";

const tones: Record<Tone, string> = {
  ok: "bg-emerald-400",
  warn: "bg-amber-400",
  danger: "bg-rose-400",
  info: "bg-sky-400",
  violet: "bg-violet-400",
  neutral: "bg-slate-400",
};

export function Progress({
  value,
  tone = "info",
  className,
  barClassName,
}: {
  value: number;
  tone?: Tone;
  className?: string;
  barClassName?: string;
}) {
  const width = clamp(value, 0, 100);

  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]", className)}
      role="progressbar"
      aria-valuenow={Math.round(width)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500",
          tones[tone],
          barClassName,
        )}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
