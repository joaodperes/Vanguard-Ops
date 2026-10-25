/** Round player-facing weapon stats without displaying binary float artifacts. */
export function formatWeaponNumber(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return "—";
  return Number(value.toFixed(Math.max(0, Math.min(4, Math.trunc(decimals))))).toString();
}
