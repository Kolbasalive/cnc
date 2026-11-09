import type { HTMLAttributes } from "react";
import type { Tone } from "@/lib/status";
import { cn } from "@/lib/utils";

const tones: Record<Tone, string> = {
  ok: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  warn: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  danger: "border-rose-400/25 bg-rose-400/10 text-rose-300",
  info: "border-sky-400/25 bg-sky-400/10 text-sky-300",
  violet: "border-violet-400/25 bg-violet-400/10 text-violet-300",
  neutral: "border-white/10 bg-white/[0.04] text-slate-300",
};

export function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone; dot?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4",
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
