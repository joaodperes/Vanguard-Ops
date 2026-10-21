/**
 * Profile-read guard for user-saved attachment maps. Only paid-for attachments
 * for THIS weapon may be equipped, even if older DB rows contain invalid IDs.
 * This is not an authentication layer for Socket.IO messages (see README).
 */
import { compatibleAttachments, weaponAttachmentSlots, weaponById, type AttachmentSlot } from "./game-data";

const SLOTS: AttachmentSlot[] = ["sight", "barrel", "grip", "magazine"];

export function sanitizeOwnedAttachments(
  weaponId: string,
  raw: string | Record<string, string | null> | undefined,
  ownedAttachmentIds: string[] = [],
): Record<AttachmentSlot, string | null> {
  let saved: Record<string, unknown> = {};
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) saved = parsed as Record<string, unknown>;
    } catch { /* Ignore malformed legacy JSON. */ }
  } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    saved = raw;
  }
  const supported = new Set(weaponAttachmentSlots(weaponById(weaponId)));
  const owned = new Set(ownedAttachmentIds);
  const out = { sight: null, barrel: null, grip: null, magazine: null } as Record<AttachmentSlot, string | null>;
  for (const slot of SLOTS) {
    const id = saved[slot];
    if (typeof id !== "string" || !supported.has(slot) || !owned.has(id)) continue;
    if (compatibleAttachments(weaponId, slot).includes(id)) out[slot] = id;
  }
  return out;
}
