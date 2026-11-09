import { Activity, FlaskConical, Timer } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { type StandId, useAvailability, useClimateMatches, useDemoPrograms } from "@/api/queries";
import { ShareBars } from "@/components/share-bars";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { RangeTabs } from "@/components/ui/range-tabs";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, formatDuration, formatNumber, formatPercent } from "@/lib/format";
import { isRangeKey, type RangeKey, rangeLabel } from "@/lib/range";

function AvailabilityCard({ stand, range }: { stand: StandId; range: RangeKey }) {
  const query = useAvailability(stand, range);
  const data = query.data;

  return (
    <Panel className="p-4">
      <PanelHeader
        title={`Стенд ${stand}`}
        description={`доступность за ${rangeLabel(range)}`}
        action={<Badge tone="neutral">online / offline</Badge>}
      />

      {query.isLoading ? <Skeleton className="mt-4 h-24" /> : null}
      {!query.isLoading && query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} className="mt-4" />
      ) : null}

      {data ? (
        <div className="mt-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="font-mono text-3xl font-semibold tabular text-emerald-300">
                {formatPercent(data.online_percent)}
              </div>
              <div className="mt-0.5 text-[11px] text-muted">
                offline {formatPercent(data.offline_percent)}
              </div>
            </div>
            <div className="text-right text-[11px] text-muted">
              <div className="flex items-center justify-end gap-1">
                <Timer className="h-3 w-3 text-emerald-300" />
                {formatDuration(data.online_seconds)}
              </div>
              <div className="mt-1 flex items-center justify-end gap-1">
                <Timer className="h-3 w-3 text-rose-300" />
                {formatDuration(data.offline_seconds)}
              </div>
            </div>
          </div>

          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full bg-emerald-400"
              style={{ width: `${Math.min(data.online_percent, 100)}%` }}
            />
            <div
              className="h-full bg-rose-400"
              style={{ width: `${Math.min(data.offline_percent, 100)}%` }}
            />
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

function DemoPrograms({ range }: { range: RangeKey }) {
  const query = useDemoPrograms(range);
  const data = query.data;
  const longest = data?.longest;

  return (
    <Panel className="p-4">
      <PanelHeader
        title="Программы демо-токарного"
        description={`доли времени за ${rangeLabel(range)}`}
        action={<RefreshButton onClick={() => query.refetch()} isFetching={query.isFetching} />}
      />

      {query.isLoading ? <Skeleton className="mt-4 h-40" /> : null}
      {!query.isLoading && query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} className="mt-4" />
      ) : null}

      {data ? (
        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <ShareBars items={data.items} emptyText="Программы за период не зафиксированы" />

          <div className="rounded-xl border border-border/60 bg-black/20 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted">
              <Activity className="h-3 w-3 text-violet-300" />
              самый длинный запуск
            </div>
            {longest ? (
              <>
                <p
                  className="mt-1.5 truncate font-mono text-sm text-foreground"
                  title={longest.label}
                >
                  {longest.label || "—"}
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular text-violet-300">
                  {formatDuration(longest.seconds)}
                </p>
                <p className="mt-1 text-[11px] leading-4 text-muted">
                  {formatDateTime(longest.started_at)}
                  <br />
                  {formatDateTime(longest.ended_at)}
                </p>
              </>
            ) : (
              <p className="mt-2 text-xs text-muted">Нет непрерывных запусков</p>
            )}
          </div>
        </div>
      ) : null}

      {data && data.items.length === 0 ? (
        <p className="mt-2 text-[11px] text-muted">
          Всего за период: {formatDuration(data.total_seconds)}
        </p>
      ) : null}
    </Panel>
  );
}

function ClimateMatches({ range }: { range: RangeKey }) {
  const query = useClimateMatches(range);
  const items = query.data?.items ?? [];
  const latest = [...items].slice(-8).reverse();

  return (
    <Panel className="p-4">
      <PanelHeader
        title="Температура = влажность"
        description={`совпадения демо-ЧПУ за ${rangeLabel(range)}`}
        action={<Badge tone={items.length > 0 ? "violet" : "neutral"}>{items.length}</Badge>}
      />

      {query.isLoading ? <Skeleton className="mt-4 h-40" /> : null}
      {!query.isLoading && query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} className="mt-4" />
      ) : null}

      {!query.isLoading && !query.error && items.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="Совпадений нет"
          description="За выбранный период температура и влажность демо-ЧПУ ни разу не совпали."
          className="mt-4"
        />
      ) : null}

      {latest.length > 0 ? (
        <ul className="mt-4 space-y-1.5">
          {latest.map((item) => (
            <li
              key={`${item.received_at}-${item.value}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-black/20 px-2.5 py-2 text-xs"
            >
              <span className="text-muted">{formatDateTime(item.received_at)}</span>
              <span className="font-mono text-violet-300">{formatNumber(item.value, 2)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}

export function AnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawRange = searchParams.get("range");
  const range: RangeKey = isRangeKey(rawRange) ? rawRange : "24h";

  const setRange = (next: RangeKey) => {
    const params = new URLSearchParams(searchParams);
    params.set("range", next);
    setSearchParams(params, { replace: true });
  };

  return (
    <div>
      <PageHeader
        eyebrow="Аналитика"
        title="Отчёты"
        description="Доступность стендов, программы демо-токарного и забавная корреляция температуры с влажностью."
        actions={<RangeTabs value={range} onChange={setRange} />}
      />

      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <AvailabilityCard stand={3} range={range} />
          <AvailabilityCard stand={5} range={range} />
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <DemoPrograms range={range} />
          </div>
          <ClimateMatches range={range} />
        </div>
      </div>
    </div>
  );
}
