import { AlertTriangle, RotateCw } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Не удалось загрузить данные";
}

export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn("rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-5 py-4", className)}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-rose-200">API недоступно</p>
          <p className="mt-1 break-words text-xs text-rose-200/70">{errorMessage(error)}</p>
          <p className="mt-1 text-xs text-muted">
            Проверь, что бэкенд запущен на{" "}
            <code className="font-mono text-foreground/80">127.0.0.1:8080</code>.
          </p>
        </div>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-foreground transition hover:bg-white/10"
          >
            <RotateCw className="h-3 w-3" />
            Повторить
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function QueryBoundary({
  isLoading,
  error,
  onRetry,
  skeleton,
  children,
}: {
  isLoading: boolean;
  error: unknown;
  onRetry?: () => void;
  skeleton: ReactNode;
  children: ReactNode;
}) {
  if (isLoading) return <>{skeleton}</>;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  return <>{children}</>;
}
