import type { EChartsCoreOption } from "echarts/core";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Gauge,
  Timer,
} from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import {
  type ShareKind,
  type Snapshot,
  type StandId,
  useAvailability,
  useCncHistory,
  useCncLatest,
  useStandErrors,
  useStandShare,
} from "@/api/queries";
import { EChart } from "@/components/e-chart";
import { RelativeTime } from "@/components/relative-time";
import { ShareBars } from "@/components/share-bars";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Progress } from "@/components/ui/progress";
import { RangeTabs } from "@/components/ui/range-tabs";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatDateTime,
  formatDuration,
  formatNumber,
  formatPercent,
  formatTimeShort,
} from "@/lib/format";
import { isRangeKey, type RangeKey, rangeLabel } from "@/lib/range";
import { isSnapshotStale, modeTone, programTone, statusTone } from "@/lib/status";
import { cn } from "@/lib/utils";

const CHART_COLORS = [
  "#22d3ee",
  "#fbbf24",
  "#a78bfa",
  "#34d399",
  "#fb7185",
  "#60a5fa",
  "#f472b6",
  "#94a3b8",
];

function buildAxisOption(items: Snapshot[], range: RangeKey): EChartsCoreOption {
  const seriesMap = new Map<string, Array<[number, number]>>();

  for (const snapshot of items) {
    const timestamp = Date.parse(snapshot.received_at);
    for (const axis of snapshot.axes) {
      const key = `Канал ${axis.channel} · ${axis.axis}`;
      const points = seriesMap.get(key) ?? [];
      points.push([timestamp, axis.position_mm]);
      seriesMap.set(key, points);
    }
  }

  return {
    backgroundColor: "transparent",
    color: CHART_COLORS,
    animationDuration: 250,
    grid: { left: 52, right: 20, top: 42, bottom: 58 },
    tooltip: {
      trigger: "axis",
      backgroundColor: "#0d141c",
      borderColor: "#1d2a38",
      textStyle: { color: "#e6edf5", fontSize: 12 },
      valueFormatter: (value: unknown) => {
        const raw = Array.isArray(value) ? value[value.length - 1] : value;
        return `${formatNumber(Number(raw), 3)} мм`;
      },
    },
    legend: {
      top: 0,
      type: "scroll",
      textStyle: { color: "#9fb0c3", fontSize: 11 },
      itemWidth: 10,
      itemHeight: 10,
      icon: "roundRect",
    },
    xAxis: {
      type: "time",
      boundaryGap: false,
      axisLine: { lineStyle: { color: "#1d2a38" } },
      axisLabel: {
        color: "#7d8fa3",
        hideOverlap: true,
        formatter: (value: number) => {
          const date = new Date(value);
          const time = formatTimeShort(value);
          if (range === "24h") {
            return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")} ${time}`;
          }
          return time;
        },
      },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      name: "мм",
      nameTextStyle: { color: "#7d8fa3", fontSize: 10 },
      axisLabel: { color: "#7d8fa3" },
      splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.09)" } },
    },
    dataZoom: [
      { type: "inside" },
      {
        type: "slider",
        height: 16,
        bottom: 10,
        borderColor: "#1d2a38",
        backgroundColor: "rgba(13, 20, 28, 0.6)",
        fillerColor: "rgba(34, 211, 238, 0.12)",
        textStyle: { color: "#7d8fa3", fontSize: 10 },
        handleStyle: { color: "#22d3ee" },
        moveHandleStyle: { color: "#22d3ee" },
      },
    ],
    series: [...seriesMap.entries()].map(([name, data]) => ({
      name,
      type: "line",
      data,
      showSymbol: false,
      smooth: false,
      sampling: "lttb",
      lineStyle: { width: 1.6 },
      emphasis: { focus: "series" },
    })),
  };
}

function Meta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 bg-black/20 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-0.5 truncate font-mono text-xs text-foreground">{value}</div>
    </div>
  );
}

function CurrentState({ stand }: { stand: StandId }) {
  const latestQuery = useCncLatest(stand);
  const latest = latestQuery.data?.[0];

  return (
    <Panel className="h-full p-4">
      <PanelHeader
        title="Текущее состояние"
        description={
          latest ? (
            <span>
              снимок <RelativeTime value={latest.received_at} />
            </span>
          ) : (
            "последний снимок стенда"
          )
        }
        action={
          <RefreshButton
            onClick={() => latestQuery.refetch()}
            isFetching={latestQuery.isFetching}
          />
        }
      />

      {latestQuery.isLoading ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-16" />
        </div>
      ) : null}

      {!latestQuery.isLoading && latestQuery.error ? (
        <ErrorState
          error={latestQuery.error}
          onRetry={() => latestQuery.refetch()}
          className="mt-4"
        />
      ) : null}

      {latest ? (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-black/20 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted">Статус канала</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{latest.status || "—"}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone={statusTone(latest.status)}>{latest.status || "нет статуса"}</Badge>
                <Badge tone={modeTone(latest.mode)}>{latest.mode || "режим —"}</Badge>
                <Badge tone={isSnapshotStale(latest) ? "danger" : "ok"} dot>
                  {isSnapshotStale(latest) ? "offline" : "online"}
                </Badge>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-black/20 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[10px] uppercase tracking-wider text-muted">Программа</p>
                <span className="font-mono text-xs text-foreground">
                  {latest.program_percent !== null && latest.program_percent !== undefined
                    ? `${latest.program_percent}%`
                    : "—"}
                </span>
              </div>
              <p
                className="mt-1 truncate font-mono text-sm text-foreground"
                title={latest.program_name || undefined}
              >
                {latest.program_name || "—"}
              </p>
              <Progress
                value={latest.program_percent ?? 0}
                tone={programTone(latest.program_percent)}
                className="mt-2"
              />
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {latest.program_time || "—"}
                </span>
                <span>{latest.channel_count ? `${latest.channel_count} канал(а)` : ""}</span>
              </div>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[...latest.axes]
              .sort((a, b) => a.channel - b.channel || a.axis.localeCompare(b.axis))
              .slice(0, 8)
              .map((axis) => (
                <div
                  key={`${axis.channel}-${axis.axis}`}
                  className="rounded-lg border border-border/60 bg-black/20 px-2.5 py-2"
                >
                  <div className="text-[10px] uppercase tracking-wider text-muted">
                    К{axis.channel} · {axis.axis}
                  </div>
                  <div className="mt-0.5 font-mono text-base font-semibold tabular text-foreground">
                    {formatNumber(axis.position_mm, 3)}
                    <span className="ml-1 text-[10px] font-normal text-muted">мм</span>
                  </div>
                </div>
              ))}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Meta label="Ядро сейчас" value={latest.core_runtime_current || "—"} />
            <Meta label="Ядро всего" value={latest.core_runtime_total || "—"} />
            <Meta label="Канал сейчас" value={latest.channel_runtime_current || "—"} />
            <Meta
              label="Перезапуски"
              value={
                latest.core_restarts !== null && latest.core_restarts !== undefined
                  ? latest.core_restarts
                  : "—"
              }
            />
          </div>

          {latest.errors.length > 0 ? (
            <div className="mt-3 rounded-lg border border-rose-400/15 bg-rose-400/[0.05] p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-rose-200">
                <AlertTriangle className="h-3.5 w-3.5" />
                Активные ошибки: {latest.errors.length}
              </div>
              <ul className="mt-2 space-y-1.5">
                {latest.errors.slice(0, 4).map((error) => (
                  <li
                    key={`${error.code}-${error.channel}-${error.reported_at ?? ""}-${error.message}`}
                    className="text-xs text-rose-100/80"
                  >
                    <span className="font-mono text-rose-200">{error.code || "—"}</span>
                    {" · "}
                    {error.message || "без описания"}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-400/15 bg-emerald-400/[0.04] px-3 py-2 text-xs text-emerald-200/80">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Активных ошибок нет
            </div>
          )}
        </>
      ) : null}

      {!latestQuery.isLoading && !latestQuery.error && !latest ? (
        <EmptyState
          icon={Gauge}
          title="Нет снимков"
          description="Стенд ещё не присылал данные."
          className="mt-4"
        />
      ) : null}
    </Panel>
  );
}

function AvailabilityPanel({ stand, range }: { stand: StandId; range: RangeKey }) {
  const query = useAvailability(stand, range);
  const data = query.data;

  return (
    <Panel className="h-full p-4">
      <PanelHeader
        title="Доступность"
        description={`за ${rangeLabel(range)} · offline после минуты без смены ядра`}
      />

      {query.isLoading ? <Skeleton className="mt-4 h-32" /> : null}
      {!query.isLoading && query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} className="mt-4" />
      ) : null}

      {data ? (
        <div className="mt-4">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-4xl font-semibold tabular text-emerald-300">
              {formatPercent(data.online_percent)}
            </span>
            <span className="text-xs text-muted">online</span>
          </div>

          <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full bg-emerald-400"
              style={{ width: `${Math.min(data.online_percent, 100)}%` }}
            />
            <div
              className="h-full bg-rose-400"
              style={{ width: `${Math.min(data.offline_percent, 100)}%` }}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border border-border/60 bg-black/20 px-2.5 py-2">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted">
                <Timer className="h-3 w-3 text-emerald-300" />
                online
              </div>
              <div className="mt-0.5 font-mono text-foreground">
                {formatDuration(data.online_seconds)}
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-black/20 px-2.5 py-2">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted">
                <Timer className="h-3 w-3 text-rose-300" />
                offline
              </div>
              <div className="mt-0.5 font-mono text-foreground">
                {formatDuration(data.offline_seconds)}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {!query.isLoading && !query.error && !data ? (
        <EmptyState
          title="Нет данных"
          description="За выбранный период снимков не было."
          className="mt-4"
        />
      ) : null}
    </Panel>
  );
}

function SharePanel({
  stand,
  range,
  kind,
  title,
}: {
  stand: StandId;
  range: RangeKey;
  kind: ShareKind;
  title: string;
}) {
  const query = useStandShare(stand, kind, range);

  return (
    <Panel className="p-4">
      <PanelHeader
        title={title}
        description={`за ${rangeLabel(range)}`}
        action={
          query.data ? (
            <span className="text-[11px] text-muted">
              {formatDuration(query.data.total_seconds)}
            </span>
          ) : null
        }
      />
      <div className="mt-4">
        {query.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
          </div>
        ) : null}
        {!query.isLoading && query.error ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : null}
        {query.data ? <ShareBars items={query.data.items} /> : null}
      </div>
    </Panel>
  );
}

function AxisChart({ stand, range }: { stand: StandId; range: RangeKey }) {
  const history = useCncHistory(stand, range);
  const items = history.data?.items ?? [];
  const option = useMemo(() => buildAxisOption(items, range), [items, range]);

  const seriesCount = history.data
    ? new Set(
        history.data.items.flatMap((snapshot) =>
          snapshot.axes.map((axis) => `${axis.channel}-${axis.axis}`),
        ),
      ).size
    : 0;

  return (
    <Panel className="p-4">
      <PanelHeader
        title="Перемещения по осям"
        description={`${rangeLabel(range)} · ${items.length} снимков`}
        action={
          <div className="flex items-center gap-2">
            {history.data?.truncated ? <Badge tone="warn">обрезано 5000</Badge> : null}
            <Badge tone="neutral">{seriesCount} рядов</Badge>
            <RefreshButton onClick={() => history.refetch()} isFetching={history.isFetching} />
          </div>
        }
      />

      <div className="mt-4">
        {history.isLoading ? <Skeleton className="h-[340px]" /> : null}
        {!history.isLoading && history.error ? (
          <ErrorState error={history.error} onRetry={() => history.refetch()} />
        ) : null}
        {!history.isLoading && !history.error && seriesCount === 0 ? (
          <EmptyState
            icon={Activity}
            title="Нет данных по осям"
            description="За выбранный период в снимках не было позиций осей."
          />
        ) : null}
        {seriesCount > 0 ? (
          <EChart
            option={option}
            height={340}
            ariaLabel={`График перемещений осей стенда ${stand}`}
          />
        ) : null}
      </div>
    </Panel>
  );
}

function ErrorsPanel({ stand, range }: { stand: StandId; range: RangeKey }) {
  const query = useStandErrors(stand, range);
  const items = query.data?.items ?? [];
  const shown = items.slice(0, 100);

  return (
    <Panel className="p-4">
      <PanelHeader
        title="Журнал ошибок"
        description={`за ${rangeLabel(range)} · с температурой и влажностью на момент ошибки`}
        action={<Badge tone={items.length > 0 ? "danger" : "ok"}>{items.length}</Badge>}
      />

      <div className="mt-4">
        {query.isLoading ? <Skeleton className="h-32" /> : null}
        {!query.isLoading && query.error ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : null}
        {!query.isLoading && !query.error && items.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Ошибок нет"
            description="За выбранный период стенд не сообщал об ошибках."
          />
        ) : null}

        {shown.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-xs">
              <thead>
                <tr className="border-b border-border/70 text-[10px] uppercase tracking-wider text-muted">
                  <th className="px-2 py-2 font-medium">Время</th>
                  <th className="px-2 py-2 font-medium">Код</th>
                  <th className="px-2 py-2 font-medium">Кан.</th>
                  <th className="px-2 py-2 font-medium">Сообщение</th>
                  <th className="px-2 py-2 font-medium">Действие</th>
                  <th className="px-2 py-2 text-right font-medium">T°</th>
                  <th className="px-2 py-2 text-right font-medium">H%</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((item) => (
                  <tr
                    key={`${item.received_at}-${item.code}-${item.channel}-${item.reported_at ?? ""}-${item.message}`}
                    className="border-b border-border/40 last:border-0"
                  >
                    <td className="whitespace-nowrap px-2 py-2 font-mono text-[11px] text-muted">
                      {formatDateTime(item.received_at)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 font-mono text-rose-200">
                      {item.code || "—"}
                    </td>
                    <td className="px-2 py-2 text-muted">{item.channel}</td>
                    <td className="px-2 py-2">
                      <p className="text-foreground">{item.message || "—"}</p>
                      {item.description ? (
                        <p className="mt-0.5 text-[11px] text-muted">{item.description}</p>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 text-muted">{item.action || "—"}</td>
                    <td className="px-2 py-2 text-right font-mono tabular text-muted">
                      {item.temperature !== null && item.temperature !== undefined
                        ? formatNumber(item.temperature, 1)
                        : "—"}
                    </td>
                    <td className="px-2 py-2 text-right font-mono tabular text-muted">
                      {item.humidity !== null && item.humidity !== undefined
                        ? formatNumber(item.humidity, 1)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length > shown.length ? (
              <p className="mt-2 text-[11px] text-muted">
                Показаны первые {shown.length} из {items.length}. Сузь период, чтобы увидеть
                остальные.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

export function StandPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const stand: StandId = id === "5" ? 5 : 3;
  const rawRange = searchParams.get("range");
  const range: RangeKey = isRangeKey(rawRange) ? rawRange : "24h";

  if (id !== "3" && id !== "5") {
    return <Navigate to="/" replace />;
  }

  const setRange = (next: RangeKey) => {
    const params = new URLSearchParams(searchParams);
    params.set("range", next);
    setSearchParams(params, { replace: true });
  };

  return (
    <div>
      <Link
        to="/"
        className="mb-3 inline-flex items-center gap-1 text-xs text-muted transition hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Обзор
      </Link>

      <PageHeader
        eyebrow="Станок"
        title={`Стенд ${stand}`}
        description="Текущее состояние канала, история перемещений по осям, доступность и журнал ошибок."
        actions={
          <>
            <div className="inline-flex rounded-lg border border-border bg-panel p-0.5">
              {([3, 5] as const).map((item) => (
                <Link
                  key={item}
                  to={`/stands/${item}?range=${range}`}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition",
                    item === stand
                      ? "bg-accent/15 text-accent"
                      : "text-muted hover:text-foreground",
                  )}
                >
                  Стенд {item}
                </Link>
              ))}
            </div>
            <RangeTabs value={range} onChange={setRange} />
          </>
        }
      />

      <div className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <CurrentState stand={stand} />
          </div>
          <AvailabilityPanel stand={stand} range={range} />
        </div>

        <AxisChart stand={stand} range={range} />

        <div className="grid gap-4 lg:grid-cols-3">
          <SharePanel stand={stand} range={range} kind="status" title="Доли статусов" />
          <SharePanel stand={stand} range={range} kind="modes" title="Доли режимов" />
          <SharePanel stand={stand} range={range} kind="programs" title="Доли программ" />
        </div>

        <ErrorsPanel stand={stand} range={range} />
      </div>
    </div>
  );
}
