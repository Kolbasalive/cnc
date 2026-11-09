export type RangeKey = "1h" | "6h" | "24h";

export const RANGE_OPTIONS: Array<{ key: RangeKey; label: string; ms: number }> = [
  { key: "1h", label: "1 ч", ms: 60 * 60 * 1000 },
  { key: "6h", label: "6 ч", ms: 6 * 60 * 60 * 1000 },
  { key: "24h", label: "24 ч", ms: 24 * 60 * 60 * 1000 },
];

export function isRangeKey(value: string | null): value is RangeKey {
  return value === "1h" || value === "6h" || value === "24h";
}

export function rangeSpan(range: RangeKey): { from: string; to: string } {
  const option = RANGE_OPTIONS.find((item) => item.key === range) ?? RANGE_OPTIONS[0];
  const to = new Date();
  const from = new Date(to.getTime() - option.ms);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function rangeLabel(range: RangeKey): string {
  return RANGE_OPTIONS.find((item) => item.key === range)?.label ?? range;
}
