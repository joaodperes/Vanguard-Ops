# First-person support arm: reference-informed rigging

## Why the old Annihilator pose failed

The weapon catalog's **Annihilator** is `sniper_heavy` and its cosmetic
reload is `side_bolt`. The old rifle shoulder sat at camera-local Z=-0.25,
close to the animated left-hand contact; its elbow ended up beside the
wrist. During reload, the glove followed a bolt-stroke path while the
shoulder remained locked, so the forearm seemed to move independently of
the upper arm. Previous fixes optimized screen visibility rather than a
consistent skeleton.

## Animation rules

1. Preserve distinct weapon grips and compact-gun poses. Longer receivers
   (sniper rifles, heavy DMRs, LMGs and similarly long rifles) use a deeper
   shoulder anchor and longer forearm, but the arm is *not* forced on-screen.
2. Idle/ADS/recoil: left-hand contact follows the **exact gun transform**.
3. Reload: the hand and loose ammunition/bolt prop tracks are authored in
   weapon-local viewmodel units. Apply the weapon's pivot rotation and
   translation before rendering them, then smoothly release/reacquire the
   support grip at the action ends.
4. Solve the complete root-elbow-wrist chain each frame: the shoulder is
   permitted small bounded translations during hand travel and the elbow
   hint follows that travel. Sleeve segments span the computed endpoints.
5. Avoid forced on-screen elbow placement or geometric stretching except
   for genuinely unreachable edge poses. Do not change reload duration,
   magazine timing, damage, or gameplay state.

## External references

- [Unity Animation Rigging — Two Bone IK](https://docs.unity.cn/Packages/com.unity.animation.rigging%401.3/manual/constraints/TwoBoneIKConstraint.html):
  shoulder (root), elbow (mid/hint) and hand (tip/target) belong to one chain.
- [Unigine — Two Bone IK](https://developer.unigine.com/en/docs/2.22/content/animations/graph/node_library/skeleton/two_bone_ik):
  analytic solver, controlled pole vector.
- [Neil Gilbert — UE5 hand-reference-based weapon animation](https://neilgilbertg.ca/2024/04/18/ue5-hand-reference-based-weapon-animation-system-2-0/):
  weapon-relative reference mesh and hand targets with two-bone IK.
- [Blender Stack Exchange — Sniper gun reload rig](https://blender.stackexchange.com/questions/198580/animation-issue-in-sniper-gun-reload/198961):
  weapon-parented IK handles and reload hand targets.
- [Blender Artists — First-person weapon rig](https://blenderartists.org/t/first-person-weapon-rig-question/650480):
  switch left-hand target from weapon grip to reload target and back.

These are **technique references**, not third-party game art or animations
copied into Vanguard Ops.

## Manual visual QA (not replaced by passing unit tests)

Use the firing range on `dev`:

- Annihilator `sniper_heavy` — hip-fire rest, scoped ADS exit,
  repeated side-bolt reloads; verify elbow stays behind the palm at rest
  and shoulder/upper arm move with the hand through the bolt stroke.
- Longshot / heavy DMR / LMG — test both rest grip and magazine reload.
- Standard AR and shotgun — compare against previous geometry; no
  unexpected longer arms.
- Pistols, PDWs, SMGs and Bulwark — compact-grip and shield poses
  remain unchanged, including destroyed-shield fallback.
- Desktop and mobile, 60–110° FOV; check partial/aborted reload, weapon
  swap, sprint, recoil and equipment. Verify no teleport at action ends.


## November 2026 — all-weapon support-arm calibration

The earlier 0.55m receiver-length threshold selected discontinuous skeletal
profiles for assault rifles, DMRs and LMGs with similar grip locations.
Receiver-mounted sniper grips were also too close to the trigger.

The current **`calibratedSupportArm`** derives shoulder depth from each
weapon's *actual first-person support grip* at nominal hipfire, not an
arbitrary weapon category/receiver breakpoint. Two-bone IK is shared across
rifles, DMRs, LMGs, snipers and shotguns. Compact guns, launchers and an
intact Bulwark use appropriate reach while retaining this common solver.

The root shoulder follows the **already-blended** wrist movement; the prior
code multiplied by actionWeight a second time, leaving most of the upper
arm frozen during shell insertion. The elbow hint now follows the same
animation path with stronger bounded shoulder motion.

For shotguns, `firstPersonShellContacts` provides distinct loading-port and
shell-pocket targets derived from receiver dimensions. The hand and prop
are transformed by the same pitch/roll/pivot as the gun. The existing
incremental per-round gameplay, interruption, timings and
`ROUND_INSERT_FRACTION` are unchanged. Wraith Auto and Mauler CS retain
their currently incremental reload behavior despite their stylized
drum/box magazines; redesigning the magazine mechanics would be a
separate gameplay/balance change.

Regression checks now sample every modeled gun's rest geometry at desktop
and touch viewports and representative entire reload cycles for every
weapon category and reload style. This numerical verification does not
replace in-game visual QA before promotion to main.


### Last-shell visual recovery

An incremental shotgun's final round becomes usable at
`ROUND_INSERT_FRACTION = 0.70`, but the cosmetic shell-return animation
now continues through the rest of that cycle. The gameplay reload flag
ends immediately; a separate visual recovery state keeps weapon pitch,
hand, elbow and shoulder synchronized until the offhand rejoins the grip.
Fire, ADS, equipment use, weapon changes or death cancel this optional
cosmetic recovery without delaying gameplay readiness or shell credits.

## First-person scale correction (November 2026)

**Root cause:** The same physical procedural rifle meshes were shown at
`vmScale = 1.20` in first person, but `BOT_WEAPON_VISUAL_SCALE = 0.72`
for 1.8m-tall soldiers. This exaggerated long weapons by **67%** relative
to the existing world-model reference. Further shoulder/elbow tuning could
not correct that visual mismatch.

**Correction:** Long weapons use the world-model reference scale of 0.72.
The transition is smooth for short experimental emitters in rifle/DMR/shotgun
categories, while pistols, PDWs and SMGs keep 1.20 because their close-up
presentation already feels right. The mesh generator, weapon catalog,
world/bot models, damage, TTK and range are unchanged.

Nominal longitudinal spans, including procedural stock/receiver/handguard/
barrel furniture (visual model units, not collision metrics):

| Weapon | Previous first-person | New first-person |
| --- | ---: | ---: |
| VK-12 Assault | 1.43 | 0.86 |
| Behemoth AR | 1.77 | 1.06 |
| Executioner DMR | 2.09 | 1.25 |
| Leviathan LMG | 2.17 | 1.30 |
| Annihilator | 2.49 | 1.50 |

This is similar in magnitude to publicly documented overall dimensions of
an M4 (84 cm), a FN Minimi Mk3 5.56 (93.9 cm), and a large anti-material
sniper (longer than ordinary rifles). The game model units remain stylized;
the comparisons establish *relative human-scale proportions* rather than
claiming the fictional guns are real designs.

References:
- Colt M4 carbine: https://www.colt.com/wp-content/uploads/2023/02/m16a2carbinecommando9mmsmgm4carbine.pdf
- FN Minimi Mk3: https://fnherstal.com/app/uploads/sites/2/technical-data-fn-minimi-556-mk3.pdf

Viewmodel muzzle flashes, suppressors, charm and optic positions use the
same new viewmodel scale; the laser beam now originates at the transformed
muzzle rather than a hard-coded distance. The shared arm calibration uses
the transformed weapon grip. The pre-existing generic reload tracks and
loose props now shrink with each gun, while per-model shotgun shell ports
are already authored at the correct scale and must not be scaled twice.

Manual checks: VK-12/Behemoth AR; Executioner/Whisper DMR; Hailstorm and
Leviathan LMG; Longshot and Annihilator; Breacher/Wraith Auto/Mauler CS;
all magazine/bolt/shell reloads and muzzle attachments. Compare the held
gun against a third-person character and check hipfire, ADS, recoil,
laser, reload, swap and touch orientation. Numerical CI does not replace
actual on-screen visual inspection.
