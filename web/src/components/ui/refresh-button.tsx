import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export function RefreshButton({
  onClick,
  isFetching,
  className,
}: {
  onClick: () => void;
  isFetching?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-border bg-panel px-2.5 py-1.5 text-xs text-muted transition hover:border-accent/40 hover:text-foreground",
        className,
      )}
    >
      <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin text-accent")} />
      Обновить
    </button>
  );
}
