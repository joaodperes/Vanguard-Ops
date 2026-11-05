/** Round player-facing weapon stats without displaying binary float artifacts. */
export function formatWeaponNumber(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return "—";
  return Number(value.toFixed(Math.max(0, Math.min(4, Math.trunc(decimals))))).toString();
}

/** Format base bullet dispersion in milliradians for the UI only (1 mrad = 0.001 rad). */
export function formatSpreadMrad(radians: number): string {
  return Number.isFinite(radians) ? (radians * 1000).toFixed(1) : "—";
}
