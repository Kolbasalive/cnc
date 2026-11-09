const timeFormatter = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const timeShortFormatter = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function toDate(value: string | number | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatTime(value: string | number | Date): string {
  return timeFormatter.format(toDate(value));
}

export function formatTimeShort(value: string | number | Date): string {
  return timeShortFormatter.format(toDate(value));
}

export function formatDateTime(value: string | number | Date): string {
  return dateTimeFormatter.format(toDate(value));
}

export function formatDate(value: string | number | Date): string {
  return dateFormatter.format(toDate(value));
}

export function timeAgo(value: string | number | Date, now = Date.now()): string {
  const diff = Math.max(0, now - toDate(value).getTime());
  const seconds = Math.floor(diff / 1000);
  if (seconds < 10) return "только что";
  if (seconds < 60) return `${seconds} с назад`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  return `${days} дн назад`;
}

export function isStale(value: string | number | Date, thresholdSeconds = 60): boolean {
  return Date.now() - toDate(value).getTime() > thresholdSeconds * 1000;
}

/** Длительности приходят строками вида "721:47:42". */
export function parseDuration(value?: string | null): number | null {
  if (!value) return null;
  const parts = value.trim().split(":");
  if (parts.length < 2 || parts.length > 4) return null;
  const numbers = parts.map((part) => Number(part));
  if (numbers.some((number) => !Number.isFinite(number))) return null;
  return numbers.reduce((total, number) => total * 60 + number, 0);
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const whole = Math.round(seconds);
  const days = Math.floor(whole / 86400);
  const hours = Math.floor((whole % 86400) / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  if (days > 0) return `${days} д ${hours} ч`;
  if (hours > 0) return `${hours} ч ${minutes} мин`;
  if (minutes > 0) return `${minutes} мин`;
  return `${whole} с`;
}

export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
