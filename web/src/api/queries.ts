import { useQuery } from "@tanstack/react-query";
import type { RangeKey } from "@/lib/range";
import { rangeSpan } from "@/lib/range";
import { api, unwrap } from "./client";
import type { components } from "./schema";

export type Overview = components["schemas"]["Overview"];
export type MqttPoint = components["schemas"]["MqttPoint"];
export type MqttHistory = components["schemas"]["MqttHistory"];
export type SensorPoint = components["schemas"]["SensorPoint"];
export type LathePoint = components["schemas"]["LathePoint"];
export type Snapshot = components["schemas"]["Snapshot"];
export type SnapshotError = components["schemas"]["SnapshotError"];
export type SnapshotHistory = components["schemas"]["SnapshotHistory"];
export type ShareItem = components["schemas"]["ShareItem"];
export type ShareReport = components["schemas"]["ShareReport"];
export type AvailabilityReport = components["schemas"]["AvailabilityReport"];
export type ErrorReport = components["schemas"]["ErrorReport"];
export type ErrorReportItem = components["schemas"]["ErrorReportItem"];
export type DemoProgramReport = components["schemas"]["DemoProgramReport"];
export type ClimateMatch = components["schemas"]["ClimateMatch"];
export type ClimateMatchReport = components["schemas"]["ClimateMatchReport"];

export type StandId = 3 | 5;

const LIVE_INTERVAL = 5_000;
const HISTORY_INTERVAL = 30_000;
const REPORT_INTERVAL = 60_000;

export function useOverview() {
  return useQuery({
    queryKey: ["overview"],
    queryFn: () => unwrap(api.GET("/api/overview")),
    refetchInterval: LIVE_INTERVAL,
  });
}

export function useCncLatest(stand: StandId) {
  return useQuery({
    queryKey: ["cnc-latest", stand],
    queryFn: () => unwrap(api.GET("/api/cnc/latest", { params: { query: { stand } } })),
    refetchInterval: LIVE_INTERVAL,
  });
}

export function useCncHistory(stand: StandId, range: RangeKey) {
  return useQuery({
    queryKey: ["cnc-history", stand, range],
    queryFn: () => {
      const { from, to } = rangeSpan(range);
      return unwrap(
        api.GET("/api/cnc/history", {
          params: { query: { stand, from, to } },
        }),
      );
    },
    refetchInterval: HISTORY_INTERVAL,
  });
}

export function useStandErrors(stand: StandId, range: RangeKey) {
  return useQuery({
    queryKey: ["stand-errors", stand, range],
    queryFn: () => {
      const { from, to } = rangeSpan(range);
      return unwrap(
        api.GET("/api/analytics/stands/{id}/errors", {
          params: { path: { id: stand }, query: { from, to } },
        }),
      );
    },
    refetchInterval: REPORT_INTERVAL,
  });
}

export function useAvailability(stand: StandId, range: RangeKey) {
  return useQuery({
    queryKey: ["stand-availability", stand, range],
    queryFn: () => {
      const { from, to } = rangeSpan(range);
      return unwrap(
        api.GET("/api/analytics/stands/{id}/availability", {
          params: { path: { id: stand }, query: { from, to } },
        }),
      );
    },
    refetchInterval: REPORT_INTERVAL,
  });
}

export type ShareKind = "status" | "modes" | "programs";

export function useStandShare(stand: StandId, kind: ShareKind, range: RangeKey) {
  return useQuery({
    queryKey: ["stand-share", stand, kind, range],
    queryFn: () => {
      const { from, to } = rangeSpan(range);
      const params = { params: { path: { id: stand }, query: { from, to } } };
      if (kind === "status") {
        return unwrap(api.GET("/api/analytics/stands/{id}/status", params));
      }
      if (kind === "modes") {
        return unwrap(api.GET("/api/analytics/stands/{id}/modes", params));
      }
      return unwrap(api.GET("/api/analytics/stands/{id}/programs", params));
    },
    refetchInterval: REPORT_INTERVAL,
  });
}

export function useMqttLatest() {
  return useQuery({
    queryKey: ["mqtt-latest"],
    queryFn: () => unwrap(api.GET("/api/mqtt/latest")),
    refetchInterval: LIVE_INTERVAL,
  });
}

export function useMqttHistory(topic: string | null, range: RangeKey) {
  return useQuery({
    queryKey: ["mqtt-history", topic, range],
    enabled: Boolean(topic),
    queryFn: () => {
      if (!topic) throw new Error("topic is required");
      const { from, to } = rangeSpan(range);
      return unwrap(
        api.GET("/api/mqtt/history", {
          params: { query: { topic, from, to } },
        }),
      );
    },
    refetchInterval: HISTORY_INTERVAL,
  });
}

export function useDemoPrograms(range: RangeKey) {
  return useQuery({
    queryKey: ["demo-programs", range],
    queryFn: () => {
      const { from, to } = rangeSpan(range);
      return unwrap(api.GET("/api/analytics/demo/programs", { params: { query: { from, to } } }));
    },
    refetchInterval: REPORT_INTERVAL,
  });
}

export function useClimateMatches(range: RangeKey) {
  return useQuery({
    queryKey: ["climate-matches", range],
    queryFn: () => {
      const { from, to } = rangeSpan(range);
      return unwrap(
        api.GET("/api/analytics/demo/temp-humidity", { params: { query: { from, to } } }),
      );
    },
    refetchInterval: REPORT_INTERVAL,
  });
}
