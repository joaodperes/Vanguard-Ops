import type { LoadoutWire } from "./game-protocol";
import type { FrontierLoadoutPresetId } from "./game-mode-rules";

export const FRONTIER_LOADOUTS: readonly {
  id: FrontierLoadoutPresetId;
  name: string;
  role: string;
  primary: string;
  secondary: string;
  primaryAttachments: LoadoutWire["attachments"];
  secondaryAttachments: NonNullable<LoadoutWire["secondaryAttachments"]>;
  emptyPrimary?: boolean;
}[] = [
  {
    id: "scout",
    name: "Scout",
    role: "Long-range precision with a hard-hitting revolver backup",
    primary: "sniper_scout",
    secondary: "pistol_bastion",
    primaryAttachments: { sight: null, barrel: null, grip: null, magazine: null },
    secondaryAttachments: { sight: null, barrel: null, grip: "grip_fan_hammer", magazine: null },
  },
  {
    id: "breacher",
    name: "Breacher",
    role: "Aggressive close-quarters combat",
    primary: "shotgun_br",
    secondary: "pistol_side",
    primaryAttachments: { sight: null, barrel: null, grip: null, magazine: null },
    secondaryAttachments: { sight: null, barrel: null, grip: null, magazine: null },
  },
  {
    id: "hunter",
    name: "Hunter",
    role: "A deliberate crossbow kit with a reliable sidearm",
    primary: "crossbow_reclaimer",
    secondary: "pistol_ghost",
    primaryAttachments: { sight: null, barrel: null, grip: null, magazine: "mag_bolt_heavy" },
    secondaryAttachments: { sight: null, barrel: null, grip: null, magazine: null },
  },
  {
    id: "gunslinger",
    name: "Gunslinger",
    role: "Dual Bastion .45 revolvers. No primary weapon.",
    primary: "pistol_side",
    secondary: "pistol_bastion",
    primaryAttachments: { sight: null, barrel: null, grip: null, magazine: null },
    secondaryAttachments: { sight: null, barrel: "barrel_ported", grip: "grip_akimbo", magazine: "mag_rev_speedloader" },
    emptyPrimary: true,
  },
] as const;

export function isFrontierLoadoutPresetId(value: unknown): value is FrontierLoadoutPresetId {
  return typeof value === "string" && FRONTIER_LOADOUTS.some((preset) => preset.id === value);
}

export function frontierLoadoutForPreset(base: LoadoutWire, presetId: FrontierLoadoutPresetId): LoadoutWire {
  const preset = FRONTIER_LOADOUTS.find((item) => item.id === presetId);
  if (!preset) return { ...base, emptyPrimary: false };
  return {
    ...base,
    frontierPresetId: preset.id,
    perkId: undefined,
    equipmentId: undefined,
    wonderWeaponId: undefined,
    wonderModuleId: undefined,
    wonderSkinId: undefined,
    wonderKillEffectId: undefined,
    weaponId: preset.primary,
    secondaryWeaponId: preset.secondary,
    meleeWeaponId: "knife_tactical",
    weaponSkinId: "default",
    secondaryWeaponSkinId: "default",
    meleeWeaponSkinId: "default",
    primaryReticleId: undefined,
    secondaryReticleId: undefined,
    primaryCharmId: "none",
    secondaryCharmId: "none",
    meleeCharmId: "none",
    emptyPrimary: preset.emptyPrimary === true,
    attachments: { ...preset.primaryAttachments },
    secondaryAttachments: { ...preset.secondaryAttachments },
    meleeAttachments: { sight: null, barrel: null, grip: null, magazine: null },
  };
}
