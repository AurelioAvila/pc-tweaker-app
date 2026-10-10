// The data side of the live charts on PC Health: a fixed-length history,
// scaling for the rate charts, the "how is the PC doing" verdict and the
// memory split. Pure functions, so every rule is tested without a window.

export type LiveSample = {
  cpu: number;
  cores: number[];
  cpu_mhz: number | null;
  ram_total: number;
  ram_used: number;
  ram_cached: number | null;
  disk_read_bps: number | null;
  disk_write_bps: number | null;
  net_down_bps: number | null;
  net_up_bps: number | null;
};

/** Seconds of history the charts show. */
export const HISTORY = 60;

/** Appends a value and keeps the newest `max`. Never mutates `values`. */
export function push<T>(values: readonly T[], value: T, max = HISTORY): T[] {
  const next = values.length >= max ? values.slice(values.length - max + 1) : values.slice();
  next.push(value);
  return next;
}

/** A chart ceiling for rates: the largest recent value rounded up to a
 *  1/2/5 step, never below `floor`, so an idle disk is a flat line instead of
 *  noise blown up to full height. */
export function niceCeiling(values: readonly (number | null)[], floor: number): number {
  const top = Math.max(floor, ...values.map((v) => (v !== null && Number.isFinite(v) ? v : 0)));
  const power = 10 ** Math.floor(Math.log10(top));
  for (const step of [1, 2, 5, 10]) if (top <= step * power) return step * power;
  return 10 * power;
}

export type Verdict = "smooth" | "busy" | "strained";

/** How the PC is doing, from the last ten seconds of real load. `null` until
 *  there are three readings to judge from. */
export function verdict(
  cpu: readonly number[],
  memoryPct: number | null,
): { verdict: Verdict; cpu: number } | null {
  const recent = cpu.slice(-10);
  if (recent.length < 3) return null;
  const average = recent.reduce((sum, v) => sum + v, 0) / recent.length;
  const ram = memoryPct ?? 0;
  const v: Verdict =
    average >= 90 || ram >= 92 ? "strained" : average >= 70 || ram >= 85 ? "busy" : "smooth";
  return { verdict: v, cpu: Math.round(average) };
}

/** Used, cached and free as fractions of the total that add up to 1. */
export function memorySplit(sample: Pick<LiveSample, "ram_total" | "ram_used" | "ram_cached">) {
  const total = sample.ram_total;
  if (!total || total <= 0) return null;
  const used = Math.min(Math.max(sample.ram_used, 0), total);
  const cached = Math.min(Math.max(sample.ram_cached ?? 0, 0), total - used);
  return { used: used / total, cached: cached / total, free: (total - used - cached) / total };
}

/** Bytes per second as a short, honest label: "820 KB/s", "12.4 MB/s". */
export function formatRate(bps: number | null, lang?: string): string | null {
  if (bps === null || !Number.isFinite(bps) || bps < 0) return null;
  const units = ["B/s", "KB/s", "MB/s", "GB/s"];
  let value = bps;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = value >= 100 || unit === 0 ? 0 : 1;
  return `${value.toLocaleString(lang, { maximumFractionDigits: digits, minimumFractionDigits: digits })} ${units[unit]}`;
}

/** Bytes as GB with one decimal: memory and drive sizes. */
export function formatGB(bytes: number, lang?: string): string {
  return `${(bytes / 1024 ** 3).toLocaleString(lang, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} GB`;
}

/** Whether the thermal report has any real sensor reading at all. */
export function hasSensors(
  report: {
    cpu_temp_c: number | null;
    gpus: { temp_c: number | null; utilization_pct: number | null; fan_pct: number | null }[];
  } | null,
): boolean {
  if (!report) return false;
  return (
    report.cpu_temp_c !== null ||
    report.gpus.some((g) => g.temp_c !== null || g.utilization_pct !== null || g.fan_pct !== null)
  );
}

/** SVG path points for a series scaled into `width` x `height`; a gap in the
 *  data (null) is drawn at zero so the line never jumps to an invented value. */
export function sparkPoints(
  values: readonly (number | null)[],
  max: number,
  width: number,
  height: number,
  slots = HISTORY,
): [number, number][] {
  const step = width / Math.max(1, slots - 1);
  const offset = slots - values.length;
  return values.map((v, i) => {
    const ratio =
      max > 0 && v !== null && Number.isFinite(v) ? Math.min(1, Math.max(0, v / max)) : 0;
    return [(offset + i) * step, height - ratio * height];
  });
}
