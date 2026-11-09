import { useNow } from "@/hooks/use-now";
import { formatDateTime, timeAgo } from "@/lib/format";

export function RelativeTime({ value, className }: { value: string; className?: string }) {
  const now = useNow(10_000);

  return (
    <time dateTime={value} title={formatDateTime(value)} className={className}>
      {timeAgo(value, now)}
    </time>
  );
}
