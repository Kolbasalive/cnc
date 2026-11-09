import type { SensorPoint } from "@/api/queries";

export interface SensorGroup {
  key: string;
  label: string;
  source: SensorPoint["source"];
  standId: number | null;
  temp?: SensorPoint;
  humidity?: SensorPoint;
  updatedAt?: string;
}

function sourceRank(source: SensorPoint["source"]): number {
  if (source === "stand") return 0;
  if (source === "demodata") return 1;
  if (source === "demo_lathe") return 2;
  return 3;
}

export function sourceLabel(sensor: Pick<SensorPoint, "source" | "stand_id">): string {
  if (sensor.source === "stand") {
    return sensor.stand_id ? `Стенд ${sensor.stand_id}` : "Стенд";
  }
  if (sensor.source === "demodata") return "Демо-данные";
  if (sensor.source === "demo_lathe") return "Демо-токарный";
  return sensor.source;
}

export function groupSensors(sensors: SensorPoint[]): SensorGroup[] {
  const groups = new Map<string, SensorGroup>();

  for (const sensor of sensors) {
    const standId = sensor.stand_id ?? null;
    const key = `${sensor.source}:${standId ?? "none"}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        label: sourceLabel(sensor),
        source: sensor.source,
        standId,
      };
      groups.set(key, group);
    }

    if (sensor.metric === "temp") group.temp = sensor;
    if (sensor.metric === "humidity") group.humidity = sensor;

    if (!group.updatedAt || Date.parse(sensor.received_at) > Date.parse(group.updatedAt)) {
      group.updatedAt = sensor.received_at;
    }
  }

  return [...groups.values()].sort((a, b) => {
    const rank = sourceRank(a.source) - sourceRank(b.source);
    if (rank !== 0) return rank;
    return (a.standId ?? 0) - (b.standId ?? 0);
  });
}
