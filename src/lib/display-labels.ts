/**
 * Presentation-only labels for IDs coming from game rules, maps and API data.
 * IDs themselves must remain unchanged for saves, unlocks and networking.
 */
const ACRONYMS: Record<string, string> = {
  ads: "ADS", cqc: "CQC", dmr: "DMR", ffa: "FFA", lmg: "LMG",
  pve: "PvE", pvp: "PvP", smg: "SMG", xp: "XP",
};

const WEAPON_CATEGORY_LABELS: Record<string, string> = {
  assault: "Assault Rifle",
  smg: "SMG",
  shotgun: "Shotgun",
  dmr: "DMR",
  sniper: "Sniper Rifle",
  lmg: "LMG",
  sidearm: "Sidearm",
  melee: "Melee",
};

function titleToken(token: string): string {
  return ACRONYMS[token.toLowerCase()]
    ?? token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

/** Convert machine identifiers into labels, preserving already-authored copy. */
export function displayLabel(value: string | null | undefined): string {
  const label = value?.trim() ?? "";
  if (!label) return "";
  // Leave proper names, descriptions, and other authored text untouched.
  if (!/^[A-Za-z0-9]+(?:[_-][A-Za-z0-9]+)*$/.test(label)) return label;
  return label.split(/[_-]/).map(titleToken).join(" ");
}

/** Map variant IDs such as city_day are shown as City (Day). */
export function displayMapLabel(value: string | null | undefined): string {
  const label = value?.trim() ?? "";
  if (!label) return "Unknown Map";
  const variant = label.match(/^(.+)[_-](day|night|dawn|dusk)$/i);
  return variant
    ? `${displayLabel(variant[1])} (${displayLabel(variant[2])})`
    : displayLabel(label);
}

export function weaponCategoryLabel(category: string): string {
  return WEAPON_CATEGORY_LABELS[category] ?? displayLabel(category);
}
