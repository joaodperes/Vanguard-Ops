import * as THREE from "three";

/**
 * The Bullet Spitter is a REAL, persistent 3D world prop rather than a HUD
 * marker or the player's held gun. Its feet sit on the walkable surface and
 * only its armored gun head traverses while the tripod remains planted.
 */
export interface BulletSpitterModel {
  root: THREE.Group;
  yawPivot: THREE.Group;
  barrelPivot: THREE.Group;
  sensor: THREE.Mesh;
}

export function buildBulletSpitterModel(): BulletSpitterModel {
  const root = new THREE.Group();
  root.name = "bullet-spitter-world";
  root.userData.isWorldTurret = true;

  // Lit metal with a little emissive lift remains legible on dark maps. The
  // amber panels are unlit so players can spot the physical structure nearby.
  const armor = new THREE.MeshStandardMaterial({
    color: 0x8b969f, metalness: 0.5, roughness: 0.43,
    emissive: 0x202b35, emissiveIntensity: 0.36,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x26313c, metalness: 0.55, roughness: 0.51,
  });
  const steel = new THREE.MeshStandardMaterial({
    color: 0x515f6f, metalness: 0.65, roughness: 0.3,
  });
  const amber = new THREE.MeshBasicMaterial({ color: 0xffbb34 });
  const amberBright = new THREE.MeshBasicMaterial({ color: 0xffe78b });
  const muzzleDark = new THREE.MeshBasicMaterial({ color: 0x0e141a });

  function add(
    parent: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material,
    x: number, y: number, z: number, name: string,
  ): THREE.Mesh {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.name = name;
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }

  // Broad steel floor anchor with three recognizable, splayed support legs.
  add(root, new THREE.CylinderGeometry(.46, .59, .19, 12), dark,
    0, .13, 0, "turret-base");
  add(root, new THREE.CylinderGeometry(.30, .40, .11, 12), armor,
    0, .27, 0, "turret-base-top");
  for (let index = 0; index < 3; index++) {
    const angle = index * Math.PI * 2 / 3;
    const end = new THREE.Vector3(Math.sin(angle) * .79, .12, Math.cos(angle) * .79);
    const start = new THREE.Vector3(0, .58, 0);
    const axis = end.clone().sub(start);
    const strut = add(root,
      new THREE.CylinderGeometry(.065, .083, axis.length(), 8), steel,
      (start.x + end.x) / 2, (start.y + end.y) / 2,
      (start.z + end.z) / 2, "turret-tripod-leg");
    strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize());
    add(root, new THREE.BoxGeometry(.29, .08, .35), dark,
      end.x, .09, end.z, "turret-foot");
  }

  add(root, new THREE.CylinderGeometry(.15, .22, .71, 12), steel,
    0, .67, 0, "turret-pedestal");
  add(root, new THREE.CylinderGeometry(.34, .31, .18, 12), dark,
    0, 1.03, 0, "turret-yaw-bearing");

  // The head rotates; the base NEVER turns with it.
  const yawPivot = new THREE.Group();
  yawPivot.name = "turret-yaw-head";
  yawPivot.position.y = 1.13;
  root.add(yawPivot);

  add(yawPivot, new THREE.BoxGeometry(.86, .40, .69), armor,
    0, .17, 0, "turret-armored-housing");
  for (const side of [-1, 1]) {
    const plate = add(yawPivot, new THREE.BoxGeometry(.105, .46, .62), dark,
      side * .44, .18, -.01, "turret-side-armor");
    plate.rotation.z = side * -.13;
    add(yawPivot, new THREE.BoxGeometry(.12, .08, .39), amber,
      side * .505, .31, .0, "turret-side-status");
  }

  // Side-mounted ammunition hopper gives a recognizable machine-gun profile.
  const drum = add(yawPivot, new THREE.CylinderGeometry(.22, .22, .22, 14),
    steel, -.60, .13, -.05, "turret-ammo-drum");
  drum.rotation.z = Math.PI / 2;
  const drumCap = add(yawPivot, new THREE.CylinderGeometry(.14, .14, .015, 14),
    amber, -.72, .13, -.05, "turret-ammo-drum-cap");
  drumCap.rotation.z = Math.PI / 2;

  // A separate elevation pivot supports two actual cylindrical gun barrels.
  const barrelPivot = new THREE.Group();
  barrelPivot.name = "turret-elevation-guns";
  barrelPivot.position.y = .16;
  yawPivot.add(barrelPivot);
  for (const side of [-1, 1]) {
    const x = side * .19;
    const shroud = add(barrelPivot, new THREE.BoxGeometry(.21, .21, .39), dark,
      x, .0, .34, "turret-barrel-shroud");
    shroud.castShadow = true;
    const barrel = add(barrelPivot,
      new THREE.CylinderGeometry(.076, .084, .83, 12), steel,
      x, 0, .74, "turret-gun-barrel");
    barrel.rotation.x = Math.PI / 2;
    add(barrelPivot, new THREE.TorusGeometry(.088, .026, 8, 16), armor,
      x, 0, 1.17, "turret-muzzle-ring");
    add(barrelPivot, new THREE.CircleGeometry(.054, 12), muzzleDark,
      x, 0, 1.179, "turret-muzzle-bore");
  }

  const sensor = add(yawPivot, new THREE.BoxGeometry(.38, .15, .39), amber,
    0, .51, .02, "turretSensor");
  add(yawPivot, new THREE.BoxGeometry(.18, .06, .20), amberBright,
    0, .60, .06, "turret-sensor-light");

  add(root, new THREE.TorusGeometry(.48, .031, 8, 30), amber,
    0, .235, 0, "turret-anchor-ring").rotation.x = Math.PI / 2;
  return { root, yawPivot, barrelPivot, sensor };
}
