/** Bounded measurements, with percentile sorting only when diagnostics are read. */
export class PerformanceSamples {
  private values: Float64Array;
  private cursor = 0;
  private count = 0;
  constructor(capacity = 240) { this.values = new Float64Array(capacity); }
  add(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) return;
    this.values[this.cursor] = ms;
    this.cursor = (this.cursor + 1) % this.values.length;
    this.count = Math.min(this.count + 1, this.values.length);
  }
  summary(): { samples: number; p50: number; p95: number; p99: number; max: number } {
    const sorted = Array.from(this.values.subarray(0, this.count)).sort((a, b) => a - b);
    const percentile = (p: number) => sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] ?? 0;
    return { samples: this.count, p50: percentile(.5), p95: percentile(.95), p99: percentile(.99), max: sorted.at(-1) ?? 0 };
  }
}
