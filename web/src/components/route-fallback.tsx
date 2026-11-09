import { Skeleton } from "@/components/ui/skeleton";

export function RouteFallback() {
  return (
    <div>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-3">
          <Skeleton className="h-[260px] xl:col-span-2" />
          <Skeleton className="h-[260px]" />
        </div>
        <Skeleton className="h-[420px]" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-[180px]" />
          <Skeleton className="h-[180px]" />
          <Skeleton className="h-[180px]" />
        </div>
      </div>
    </div>
  );
}
