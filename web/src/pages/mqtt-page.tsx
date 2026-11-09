import type { EChartsCoreOption } from "echarts/core";
import { Radio, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { type MqttPoint, useMqttHistory, useMqttLatest } from "@/api/queries";
import { EChart } from "@/components/e-chart";
import { RelativeTime } from "@/components/relative-time";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { RangeTabs } from "@/components/ui/range-tabs";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, formatNumber, formatTimeShort } from "@/lib/format";
import { isRangeKey, type RangeKey, rangeLabel } from "@/lib/range";
import { cn } from "@/lib/utils";

function displayValue(point: MqttPoint): string {
  if (point.value_num !== null && point.value_num !== undefined) {
    return formatNumber(point.value_num, 3);
  }
  return point.value_text || "—";
}

function isNumeric(point: MqttPoint): boolean {
  return point.value_num !== null && point.value_num !== undefined;
}

function buildMqttOption(items: MqttPoint[], range: RangeKey): EChartsCoreOption {
  const numeric = items.every(isNumeric);

  const base: EChartsCoreOption = {
    backgroundColor: "transparent",
    animationDuration: 250,
    grid: { left: 56, right: 20, top: 28, bottom: 58 },
    tooltip: {
      trigger: "axis",
      backgroundColor: "#0d141c",
      borderColor: "#1d2a38",
      textStyle: { color: "#e6edf5", fontSize: 12 },
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
      },
    ],
  };

  if (numeric) {
    return {
      ...base,
      tooltip: {
        ...(base.tooltip as object),
        valueFormatter: (value: unknown) => {
          const raw = Array.isArray(value) ? value[value.length - 1] : value;
          return formatNumber(Number(raw), 3);
        },
      },
      yAxis: {
        type: "value",
        axisLabel: { color: "#7d8fa3" },
        splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.09)" } },
      },
      series: [
        {
          name: "value",
          type: "line",
          showSymbol: false,
          sampling: "lttb",
          lineStyle: { width: 1.8, color: "#22d3ee" },
          areaStyle: { color: "rgba(34, 211, 238, 0.08)" },
          data: items.map((item) => [Date.parse(item.received_at), item.value_num]),
        },
      ],
    };
  }

  const labels: string[] = [];
  const indexByLabel = new Map<string, number>();
  for (const item of items) {
    const label = item.value_text || "—";
    if (!indexByLabel.has(label)) {
      indexByLabel.set(label, labels.length);
      labels.push(label);
    }
  }

  return {
    ...base,
    tooltip: {
      ...(base.tooltip as object),
      valueFormatter: (value: unknown) => {
        const raw = Array.isArray(value) ? value[value.length - 1] : value;
        return labels[Number(raw)] ?? "—";
      },
    },
    yAxis: {
      type: "category",
      data: labels,
      axisLabel: { color: "#7d8fa3", width: 160, overflow: "truncate" },
      splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.09)" } },
    },
    series: [
      {
        name: "state",
        type: "line",
        step: "end",
        showSymbol: false,
        lineStyle: { width: 1.8, color: "#a78bfa" },
        areaStyle: { color: "rgba(167, 139, 250, 0.08)" },
        data: items.map((item) => [
          Date.parse(item.received_at),
          indexByLabel.get(item.value_text || "—") ?? 0,
        ]),
      },
    ],
  };
}

export function MqttPage() {
  const latest = useMqttLatest();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState("");

  const rawRange = searchParams.get("range");
  const range: RangeKey = isRangeKey(rawRange) ? rawRange : "6h";
  const selectedTopic = searchParams.get("topic");

  const topics = useMemo(
    () => [...(latest.data ?? [])].sort((a, b) => a.topic.localeCompare(b.topic)),
    [latest.data],
  );

  const filtered = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return topics;
    return topics.filter((point) => point.topic.toLowerCase().includes(query));
  }, [filter, topics]);

  useEffect(() => {
    if (selectedTopic) return;
    const first = topics[0];
    if (!first) return;
    const params = new URLSearchParams(searchParams);
    params.set("topic", first.topic);
    setSearchParams(params, { replace: true });
  }, [selectedTopic, setSearchParams, searchParams, topics]);

  const history = useMqttHistory(selectedTopic, range);
  const historyItems = history.data?.items ?? [];
  const option = useMemo(() => buildMqttOption(historyItems, range), [historyItems, range]);
  const lastPoint = historyItems[historyItems.length - 1];
  const latestPoint = topics.find((point) => point.topic === selectedTopic);

  const setRange = (next: RangeKey) => {
    const params = new URLSearchParams(searchParams);
    params.set("range", next);
    setSearchParams(params, { replace: true });
  };

  const selectTopic = (topic: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("topic", topic);
    setSearchParams(params, { replace: true });
  };

  return (
    <div>
      <PageHeader
        eyebrow="MQTT"
        title="Топики"
        description="Последнее значение каждого топика и история выбранного ряда. Текстовые состояния рисуются ступенчатой линией."
        actions={
          <>
            <Badge tone="neutral">{topics.length} топиков</Badge>
            <RefreshButton onClick={() => latest.refetch()} isFetching={latest.isFetching} />
          </>
        }
      />

      {latest.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-[420px_minmax(0,1fr)]">
          <Skeleton className="h-[520px]" />
          <Skeleton className="h-[520px]" />
        </div>
      ) : null}

      {!latest.isLoading && latest.error ? (
        <ErrorState error={latest.error} onRetry={() => latest.refetch()} />
      ) : null}

      {!latest.isLoading && !latest.error && topics.length === 0 ? (
        <Panel className="p-4">
          <EmptyState
            icon={Radio}
            title="MQTT-сообщений нет"
            description="В таблице mqtt_messages пока пусто. Проверь подключение mqtt-reader к брокеру."
          />
        </Panel>
      ) : null}

      {topics.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-[420px_minmax(0,1fr)]">
          <Panel className="flex max-h-[72vh] min-h-[420px] flex-col overflow-hidden">
            <div className="border-b border-border/60 p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                <input
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  placeholder="Фильтр по топику"
                  className="w-full rounded-lg border border-border bg-black/20 py-1.5 pl-8 pr-2.5 text-xs text-foreground outline-none transition placeholder:text-muted/70 focus:border-accent/50"
                />
              </div>
              <p className="mt-2 text-[10px] uppercase tracking-wider text-muted">
                {filtered.length} из {topics.length}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="p-4 text-xs text-muted">Ничего не найдено.</p>
              ) : (
                <ul className="divide-y divide-border/40">
                  {filtered.map((point) => {
                    const selected = point.topic === selectedTopic;
                    return (
                      <li key={point.topic}>
                        <button
                          type="button"
                          onClick={() => selectTopic(point.topic)}
                          className={cn(
                            "w-full px-3 py-2.5 text-left transition",
                            selected
                              ? "bg-accent/[0.08] shadow-[inset_2px_0_0_0_#22d3ee]"
                              : "hover:bg-white/[0.03]",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={cn(
                                "truncate font-mono text-xs",
                                selected ? "text-accent" : "text-foreground/90",
                              )}
                              title={point.topic}
                            >
                              {point.topic}
                            </span>
                            <span className="shrink-0 font-mono text-xs tabular text-foreground">
                              {displayValue(point)}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-muted">
                            <span>{isNumeric(point) ? "numeric" : "text"}</span>
                            <RelativeTime value={point.received_at} />
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Panel>

          <Panel className="p-4">
            <PanelHeader
              title={selectedTopic ?? "Выбери топик"}
              description={
                selectedTopic
                  ? `история за ${rangeLabel(range)} · ${historyItems.length} точек`
                  : "Слева выбери топик, чтобы увидеть историю"
              }
              action={
                <div className="flex items-center gap-2">
                  {history.data?.truncated ? <Badge tone="warn">обрезано 5000</Badge> : null}
                  <RangeTabs value={range} onChange={setRange} />
                </div>
              }
            />

            {selectedTopic ? (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-border/60 bg-black/20 px-2.5 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted">
                    Последнее значение
                  </div>
                  <div className="mt-0.5 truncate font-mono text-base font-semibold text-foreground">
                    {latestPoint
                      ? displayValue(latestPoint)
                      : lastPoint
                        ? displayValue(lastPoint)
                        : "—"}
                  </div>
                </div>
                <div className="rounded-lg border border-border/60 bg-black/20 px-2.5 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted">Обновлено</div>
                  <div className="mt-0.5 text-xs text-foreground">
                    {latestPoint ? <RelativeTime value={latestPoint.received_at} /> : "—"}
                  </div>
                </div>
                <div className="rounded-lg border border-border/60 bg-black/20 px-2.5 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted">Тип ряда</div>
                  <div className="mt-0.5 text-xs text-foreground">
                    {historyItems.length > 0 && historyItems.every(isNumeric)
                      ? "numeric"
                      : "text / state"}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-4">
              {history.isLoading ? <Skeleton className="h-[360px]" /> : null}
              {!history.isLoading && history.error ? (
                <ErrorState error={history.error} onRetry={() => history.refetch()} />
              ) : null}
              {!history.isLoading && !history.error && historyItems.length === 0 ? (
                <EmptyState
                  icon={Radio}
                  title="Нет истории за период"
                  description="Попробуй увеличить период или проверь, что топик продолжает публиковаться."
                />
              ) : null}
              {historyItems.length > 0 ? (
                <EChart
                  option={option}
                  height={360}
                  ariaLabel={`История MQTT-топика ${selectedTopic ?? ""}`}
                />
              ) : null}
            </div>

            {lastPoint ? (
              <p className="mt-2 text-[11px] text-muted">
                последняя точка: {formatDateTime(lastPoint.received_at)} · значение{" "}
                <span className="font-mono text-foreground/80">{displayValue(lastPoint)}</span>
              </p>
            ) : null}
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
