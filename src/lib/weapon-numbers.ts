/** Round player-facing weapon stats without displaying binary float artifacts. */
export function formatWeaponNumber(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return "—";
  return Number(value.toFixed(Math.max(0, Math.min(4, Math.trunc(decimals))))).toString();
}

/** Format base bullet dispersion in milliradians for the UI only (1 mrad = 0.001 rad). */
export function formatSpreadMrad(radians: number): string {
  return Number.isFinite(radians) ? (radians * 1000).toFixed(1) : "—";
}

/** Player-facing comparison: arrows track the numerical direction; color tracks whether it helps. */
export function weaponStatDelta(previous: number, current: number, lowerIsBetter = false): {
  changed: boolean;
  improved: boolean;
  arrow: "▲" | "▼" | "";
  percent: number;
} {
  const difference = current - previous;
  return {
    changed: Math.abs(difference) > 0.000001,
    improved: lowerIsBetter ? difference < 0 : difference > 0,
    arrow: difference > 0 ? "▲" : difference < 0 ? "▼" : "",
    percent: previous !== 0 ? Math.round(Math.abs(difference / previous * 100)) : 0,
  };
}
