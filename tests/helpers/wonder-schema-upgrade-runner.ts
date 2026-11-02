import assert from "node:assert/strict";
import { getOrCreatePlayer } from "../../src/lib/player-service";

const player = await getOrCreatePlayer("old-wonder-slot-player");
assert.equal(player.name, "Legacy Wonder User");
assert.equal(player.loadout?.primaryWeapon, "rifle_ar");
assert.equal(player.loadout?.perkId, "battle_hardened");
assert.equal(player.loadout?.wonderWeaponId, "");
console.log("Legacy Wonder slot upgraded without changing player data");
