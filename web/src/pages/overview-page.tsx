import { AlertTriangle, CheckCircle2, Cog, Radio } from "lucide-react";
import type { Snapshot, SnapshotError } from "@/api/queries";
import { useOverview } from "@/api/queries";
import { DemoLatheCard } from "@/components/demo-lathe-card";
import { SensorCard } from "@/components/sensor-card";
import { StandCard } from "@/components/stand-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import { groupSensors } from "@/lib/sensors";

function OverviewSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-[360px]" />
        <Skeleton className="h-[360px]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <Skeleton key={key} className="h-[118px]" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-[260px]" />
        <Skeleton className="h-[260px] xl:col-span-2" />
      </div>
    </div>
  );
}

function MissingStand({ standId }: { standId: number }) {
  return (
    <Panel className="flex h-full min-h-[240px] items-center justify-center p-4">
      <EmptyState
        icon={Cog}
        title={`Нет снимков стенда ${standId}`}
        description="Бэкенд ещё не получал данные по этому станку. Проверь MQTT-читатель и доступность HTTP API станка."
      />
    </Panel>
  );
}

interface ActiveError extends SnapshotError {
  standId: number;
  snapshotAt: string;
}

function collectErrors(stands: Snapshot[]): ActiveError[] {
  return stands.flatMap((snapshot) =>
    snapshot.errors.map((error) => ({
      ...error,
      standId: snapshot.stand_id,
      snapshotAt: snapshot.received_at,
    })),
  );
}

function CurrentErrors({ stands }: { stands: Snapshot[] }) {
  const errors = collectErrors(stands);

  return (
    <Panel className="flex h-full flex-col p-4">
      <PanelHeader
        title="Активные ошибки"
        description="Из последних снимков стендов"
        action={
          <Badge tone={errors.length > 0 ? "danger" : "ok"}>
            {errors.length > 0 ? errors.length : "0"}
          </Badge>
        }
      />

      <div className="mt-4 flex-1">
        {errors.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Активных ошибок нет"
            description="Ни один стенд сейчас не сообщает об ошибках."
            className="h-full"
          />
        ) : (
          <ul className="space-y-2">
            {errors.slice(0, 6).map((error) => (
              <li
                key={`${error.standId}-${error.code}-${error.channel}-${error.snapshotAt}-${error.message}`}
                className="rounded-lg border border-rose-400/15 bg-rose-400/[0.05] px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <Badge tone="danger">Стенд {error.standId}</Badge>
                  {error.code ? (
                    <span className="font-mono text-rose-200/90">{error.code}</span>
                  ) : null}
                  <span className="ml-auto text-muted">{formatDateTime(error.snapshotAt)}</span>
                </div>
                <p className="mt-1 text-sm text-foreground">{error.message || "Без описания"}</p>
                {error.description || error.action ? (
                  <p className="mt-0.5 text-xs text-muted">
                    {[error.description, error.action].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

export function OverviewPage() {
  const overview = useOverview();
  const data = overview.data;

  return (
    <div>
      <PageHeader
        eyebrow="Телеметрия"
        title="Обзор"
        description="Последние снимки стендов 3 и 5, климат и сигналы демо-токарного. Данные обновляются каждые 5 секунд."
        actions={
          <>
            {overview.dataUpdatedAt ? (
              <span className="hidden text-[11px] text-muted sm:inline">
                обновлено {formatDateTime(overview.dataUpdatedAt)}
              </span>
            ) : null}
            <RefreshButton onClick={() => overview.refetch()} isFetching={overview.isFetching} />
          </>
        }
      />

      {overview.isLoading ? <OverviewSkeleton /> : null}

      {!overview.isLoading && overview.error ? (
        <ErrorState error={overview.error} onRetry={() => overview.refetch()} />
      ) : null}

      {data ? (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2">
            {[3, 5].map((standId) => {
              const snapshot = data.stands.find((item) => item.stand_id === standId);
              return snapshot ? (
                <StandCard key={standId} snapshot={snapshot} />
              ) : (
                <MissingStand key={standId} standId={standId} />
              );
            })}
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-medium text-foreground">Климат</h2>
              <span className="text-[11px] text-muted">последние значения по источникам</span>
            </div>
            {groupSensors(data.sensors).length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {groupSensors(data.sensors).map((group) => (
                  <SensorCard key={group.key} group={group} />
                ))}
              </div>
            ) : (
              <Panel className="p-4">
                <EmptyState
                  icon={Radio}
                  title="Датчики пока молчат"
                  description="В sensor_readings ещё нет данных температуры и влажности."
                />
              </Panel>
            )}
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <DemoLatheCard points={data.demo_lathe} />
            <div className="xl:col-span-2">
              <CurrentErrors stands={data.stands} />
            </div>
          </section>
        </div>
      ) : null}

      {!overview.isLoading && !overview.error && !data ? (
        <Panel className="p-4">
          <EmptyState
            icon={AlertTriangle}
            title="Нет данных"
            description="API вернул пустой ответ. Проверь бэкенд и базу данных."
          />
        </Panel>
      ) : null}
    </div>
  );
}
