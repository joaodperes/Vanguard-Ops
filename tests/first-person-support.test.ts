import { describe, expect, test } from "bun:test";
import { supportActionWeight, supportHandRestMode, supportElbowPosition, animatedSupportArm, calibratedSupportArm, supportArmFraming, usesCompactSupportArm, usesLongSupportArm, SUPPORT_LONG_UPPER_ARM_LENGTH, SUPPORT_LONG_FOREARM_LENGTH, SUPPORT_UPPER_ARM_LENGTH, SUPPORT_FOREARM_LENGTH, SUPPORT_SIDEARM_UPPER_LENGTH, SUPPORT_SIDEARM_FOREARM_LENGTH } from "../src/lib/first-person-animation";
import { firstPersonSupportGrip, weaponHoldPoints, WEAPON_VISUALS } from "../src/lib/weapon-models";

describe("first-person support hand", () => {
  test("supports ranged guns during idle, fire, ADS and sprint", () => {
    for (const category of ["assault", "smg", "shotgun", "dmr", "sniper", "lmg", "sidearm"]) {
      expect(supportHandRestMode(category, false, false)).toBe("weapon");
    }
  });
  test("keeps melee one-handed and places Bulwark hand on its intact shield", () => {
    expect(supportHandRestMode("melee", false, false)).toBe("none");
    expect(supportHandRestMode("sidearm", true, true)).toBe("shield");
    expect(supportHandRestMode("sidearm", true, false)).toBe("weapon");
  });
  test("transitions smoothly between steady grip and equipment/reload animation", () => {
    expect(supportActionWeight(-1)).toBe(0);
    expect(supportActionWeight(0)).toBe(0);
    expect(supportActionWeight(.5)).toBe(1);
    expect(supportActionWeight(1)).toBe(0);
    expect(supportActionWeight(2)).toBe(0);
    expect(supportActionWeight(.08)).toBeGreaterThan(0);
    expect(supportActionWeight(.08)).toBeLessThan(1);
    expect(supportActionWeight(.92)).toBeGreaterThan(0);
    expect(supportActionWeight(.92)).toBeLessThan(1);
    for (let p = 0; p <= 1; p += .01) {
      expect(supportActionWeight(p)).toBeGreaterThanOrEqual(0);
      expect(supportActionWeight(p)).toBeLessThanOrEqual(1);
    }
  });
});

describe("support-arm shoulder continuity", () => {
  const shoulder = supportArmFraming(16/9).shoulder;
  const length = (a: readonly number[], b: readonly number[]) =>
    Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  test("every long rifle supports a continuous shoulder -> elbow -> hand reach", () => {
    for (const id of ["sniper_lr", "sniper_heavy", "dmr_heavy", "lmg_heavy", "launcher_rocket"]) {
      const grip = firstPersonSupportGrip(id);
      // Same weapon scale and desktop hip-fire translation as the engine.
      const wrist: [number, number, number] = [
        grip[0] * 1.2 + .30 - .045,
        grip[1] * 1.2 - .18 - .125,
        grip[2] * 1.2 - .48 + .10,
      ];
      const elbow = supportElbowPosition(shoulder, wrist);
      expect(elbow.every(Number.isFinite)).toBe(true);
      expect(length(shoulder, elbow)).toBeGreaterThan(.1);
      expect(length(elbow, wrist)).toBeGreaterThan(.1);
      // The cylinder geometry is scaled to these exact segment lengths,
      // not to the old fixed 35cm sleeve that stopped short of the torso.
      expect(length(shoulder, elbow) + length(elbow, wrist)).toBeGreaterThanOrEqual(length(shoulder, wrist) - 1e-9);
    }
  });

  test("short firearms, ADS, reloads and shield hand targets never degenerate", () => {
    const targets: [number, number, number][] = [
      [.18, -.30, -.45], // two-hand pistol pose
      [-.04, -.42, -.74], // long-gun ADS pose
      [-.21, -.66, -.55], // magazine insertion
      [-.17, -.14, -.85], // bolt/vent interaction
      [-.60, -.80, -.60], // Bulwark side shield
      [-.13, -.77, -.70], // Bulwark raised shield
      [.06, -.14, -.38], // equipment use
    ];
    for (const wrist of targets) {
      const elbow = supportElbowPosition(shoulder, wrist);
      expect(elbow.every(Number.isFinite)).toBe(true);
      expect(length(shoulder, elbow)).toBeGreaterThan(.05);
      expect(length(elbow, wrist)).toBeGreaterThan(.05);
    }
  });
});

describe("compact first-person support grips for long weapons", () => {
  const shoulder = supportArmFraming(16/9).shoulder;
  const reach = (grip: readonly number[]) => {
    const wrist = [grip[0] * 1.2 + .30 - .045, grip[1] * 1.2 - .18 - .125, grip[2] * 1.2 - .48 + .10];
    return Math.hypot(wrist[0] - shoulder[0], wrist[1] - shoulder[1], wrist[2] - shoulder[2]);
  };

  test("snipers have a shorter, receiver-mounted grip with continuous arm reach", () => {
    for (const id of ["sniper_lr", "sniper_scout", "sniper_heavy"]) {
      const original = weaponHoldPoints(id).support;
      const adjusted = firstPersonSupportGrip(id);
      const profile = WEAPON_VISUALS[id];
      expect(adjusted[2]).toBeGreaterThan(original[2] + .035);
      expect(reach(adjusted)).toBeLessThan(reach(original) - .02);
      // Contact must stay on the receiver side and within its fore/aft bounds.
      expect(adjusted[2]).toBeGreaterThanOrEqual(-.12 - profile.receiver[2] / 2);
      expect(adjusted[2]).toBeLessThanOrEqual(-.12 + profile.receiver[2] / 2);
      expect(-adjusted[0]).toBeGreaterThanOrEqual(profile.receiver[0] / 2);
      const elbow = supportElbowPosition(shoulder, [
        adjusted[0] * 1.2 + .30 - .045,
        adjusted[1] * 1.2 - .18 - .125,
        adjusted[2] * 1.2 - .48 + .10,
      ]);
      expect(elbow.every(Number.isFinite)).toBe(true);
    }
  });

  test("other long receivers benefit without moving short guns, launchers or third-person grips", () => {
    for (const id of ["dmr_heavy", "rifle_heavy", "lmg_heavy", "lmg_hv", "rifle_dm"]) {
      expect(firstPersonSupportGrip(id)[2]).toBeGreaterThan(weaponHoldPoints(id).support[2]);
    }
    for (const id of ["rifle_ar", "smg_kp", "shotgun_br", "pistol_side", "launcher_rocket", "wonder_riot_shield"]) {
      expect(firstPersonSupportGrip(id)).toEqual(weaponHoldPoints(id).support);
    }
  });
});

describe("real articulated support elbow",()=>{
  const shoulder=supportArmFraming(16/9).shoulder;
  const dist=(a:readonly number[],b:readonly number[])=>
    Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
  const total=SUPPORT_UPPER_ARM_LENGTH+SUPPORT_FOREARM_LENGTH;

  test("sniper grips keep a fixed-length upper arm/forearm with actual elbow bend",()=>{
    for(const id of ["sniper_lr","sniper_scout","sniper_heavy","dmr_heavy","lmg_heavy"]){
      const grip=firstPersonSupportGrip(id);
      const wrist:[number,number,number]=[
        grip[0]*1.2+.30-.045,grip[1]*1.2-.18-.125,grip[2]*1.2-.48+.10
      ];
      const frame=calibratedSupportArm(id.startsWith("sniper")?"sniper":
        id.startsWith("lmg")?"lmg":"dmr",wrist,16/9);
      const elbow=supportElbowPosition(frame.shoulder,wrist,frame.pole,
        frame.upperLength,frame.forearmLength);
      const reach=dist(frame.shoulder,wrist);
      expect(reach).toBeLessThan(frame.upperLength+frame.forearmLength);
      expect(dist(frame.shoulder,elbow)).toBeCloseTo(frame.upperLength,6);
      expect(dist(elbow,wrist)).toBeCloseTo(frame.forearmLength,6);
      expect(elbow[2]).toBeGreaterThan(wrist[2]+.18);
      const along=((elbow[0]-frame.shoulder[0])*(wrist[0]-frame.shoulder[0])
        +(elbow[1]-frame.shoulder[1])*(wrist[1]-frame.shoulder[1])
        +(elbow[2]-frame.shoulder[2])*(wrist[2]-frame.shoulder[2]))/(reach*reach);
      const axis=frame.shoulder.map((v,i)=>v+along*(wrist[i]-v));
      expect(dist(elbow,axis)).toBeGreaterThan(.07);
    }
  });

  test("supports ADS, action poses and extreme reach without detached joints",()=>{
    const poses:[number,number,number][]=[
      [.18,-.30,-.45],[-.04,-.42,-.74],[-.21,-.66,-.55],[-.17,-.14,-.85],
      [-.60,-.80,-.60],[-.13,-.77,-.70],[.06,-.14,-.38],
      [.45,-.36,.02],[-.10,.18,-.68],[.05,-.58,-.63]
    ];
    for(const wrist of poses){
      const elbow=supportElbowPosition(shoulder,wrist);
      expect(elbow.every(Number.isFinite)).toBe(true);
      const stretch=Math.max(1,dist(shoulder,wrist)/(total*.998));
      expect(dist(shoulder,elbow)).toBeCloseTo(SUPPORT_UPPER_ARM_LENGTH*stretch,6);
      expect(dist(elbow,wrist)).toBeCloseTo(SUPPORT_FOREARM_LENGTH*stretch,6);
    }
  });

  test("recoil/sway produces a continuous elbow path instead of flips",()=>{
    const base:[number,number,number]=[.12,-.40,-.64];
    const elbow=supportElbowPosition(shoulder,base);
    let previous: [number,number,number] | undefined;
    for(let n=-10;n<=10;n++){
      const wrist:[number,number,number]=[base[0]+n*.004,base[1]+n*.001,base[2]-n*.002];
      const next=supportElbowPosition(shoulder,wrist);
      // Small recoil movements can accumulate over the full sweep, but each
      // individual animation frame must not snap or flip the elbow.
      expect(dist(elbow,next)).toBeLessThan(.09);
      if(previous) expect(dist(previous,next)).toBeLessThan(.015);
      previous=next;
    }
  });

  test("aligned pole and zero-length targets are finite",()=>{
    const pole=supportArmFraming(16/9).pole,norm=Math.hypot(...pole);
    const wrist:[number,number,number]=[
      shoulder[0]+pole[0]*.65/norm,shoulder[1]+pole[1]*.65/norm,
      shoulder[2]+pole[2]*.65/norm
    ];
    const elbow=supportElbowPosition(shoulder,wrist);
    expect(elbow.every(Number.isFinite)).toBe(true);
    expect(dist(shoulder,elbow)).toBeCloseTo(SUPPORT_UPPER_ARM_LENGTH,6);
    expect(dist(elbow,wrist)).toBeCloseTo(SUPPORT_FOREARM_LENGTH,6);
    expect(supportElbowPosition(shoulder,shoulder).every(Number.isFinite)).toBe(true);
  });
});

describe("natural support arm anatomy, rather than forced elbow visibility", () => {
  const restWrist = (id: string): [number, number, number] => {
    const grip = firstPersonSupportGrip(id);
    return [grip[0]*1.2+.30-.045, grip[1]*1.2-.18-.125, grip[2]*1.2-.48+.10];
  };
  const distance = (a: readonly number[],b:readonly number[]) =>
    Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
  const projectY = (p: readonly number[], fov=75) =>
    p[1] / (-p[2]*Math.tan(fov*Math.PI/360));

  test("elbow stays tucked below and behind the support hand, not flung above it", () => {
    for (const aspect of [16/9,4/3,1,9/16]) {
      const frame = supportArmFraming(aspect);
      for (const id of ["sniper_lr","sniper_scout","sniper_heavy",
        "rifle_ar","shotgun_br","smg_kp","dmr_heavy","lmg_heavy"]) {
        const wrist = restWrist(id);
        const elbow = supportElbowPosition(frame.shoulder,wrist,frame.pole);
        // The previous pose had an elbow ABOVE the wrist, 30cm from its
        // natural tucked position, which formed a huge inverted V.
        expect(elbow[1]).toBeLessThan(wrist[1] + .015);
        expect(elbow[0]).toBeGreaterThanOrEqual(frame.shoulder[0] - .03);
        expect(elbow[0]).toBeLessThan(wrist[0] - .02);
        expect(elbow[2]).toBeLessThan(frame.shoulder[2] - .15);
        expect(elbow[2]).toBeGreaterThan(wrist[2] - .035);
        const y = projectY(elbow);
        // Near the bottom edge, not artificially raised into the aim picture.
        expect(y).toBeLessThan(-.72);
        expect(y).toBeGreaterThan(-1.3);
      }
    }
  });

  test("anatomical lengths are short and connected on every normal rifle hold", () => {
    const frame=supportArmFraming(16/9);
    for (const id of ["sniper_lr","sniper_heavy","rifle_ar","shotgun_br","lmg_heavy"]) {
      const wrist=restWrist(id),elbow=supportElbowPosition(frame.shoulder,wrist,frame.pole);
      const reach=distance(frame.shoulder,wrist);
      const stretch=Math.max(1,reach/((SUPPORT_UPPER_ARM_LENGTH+SUPPORT_FOREARM_LENGTH)*.998));
      expect(distance(frame.shoulder,elbow)).toBeCloseTo(SUPPORT_UPPER_ARM_LENGTH*stretch,6);
      expect(distance(elbow,wrist)).toBeCloseTo(SUPPORT_FOREARM_LENGTH*stretch,6);
    }
  });

  test("sidearms tuck a compact elbow behind the wrist instead of a rifle-sized fold", () => {
    const frame=supportArmFraming(16/9, true);
    const wrist=restWrist("pistol_side");
    const elbow=supportElbowPosition(frame.shoulder,wrist,frame.pole,
      SUPPORT_SIDEARM_UPPER_LENGTH,SUPPORT_SIDEARM_FOREARM_LENGTH);
    expect(elbow[1]).toBeLessThan(wrist[1]);
    // Arm segments advance toward the gun: shoulder -> elbow -> wrist in Z.
    expect(frame.shoulder[2] - elbow[2]).toBeGreaterThan(.15);
    expect(elbow[2] - wrist[2]).toBeGreaterThan(.15);
    expect(distance(elbow,wrist)).toBeCloseTo(SUPPORT_SIDEARM_FOREARM_LENGTH,6);
  });

  test("resize, recoil and reload keep continuous, finite joint positions", () => {
    const wrist=restWrist("sniper_lr");
    let previous: [number,number,number] | null=null;
    for(let aspect=9/16;aspect<=16/9;aspect+=.01) {
      const frame=supportArmFraming(aspect);
      const next=supportElbowPosition(frame.shoulder,wrist,frame.pole);
      expect(next.every(Number.isFinite)).toBe(true);
      if(previous) expect(distance(previous,next)).toBeLessThan(.015);
      previous=next;
    }
    const frame=supportArmFraming(16/9);
    for(const wrist of [[-.21,-.66,-.55],[-.17,-.14,-.85],[.45,-.36,.02],
      [-.60,-.80,-.60],[-.10,.18,-.68]]) {
      expect(supportElbowPosition(frame.shoulder,wrist,frame.pole).every(Number.isFinite)).toBe(true);
    }
  });
});

describe("compact support arm never folds backward", () => {
  const dist=(a:readonly number[],b:readonly number[])=>
    Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
  const wristFor=(id:string):[number,number,number]=>{
    const g=firstPersonSupportGrip(id);
    return [g[0]*1.2+.30-.045,g[1]*1.2-.18-.125,g[2]*1.2-.48+.10];
  };

  test("selects compact posing for pistols, PDWs, SMGs and destroyed shield only", () => {
    for(const category of ["pistol","pdw","smg"])
      expect(usesCompactSupportArm(category,false,false)).toBe(true);
    for(const category of ["sniper","assault","shotgun","dmr","lmg","launcher","melee"])
      expect(usesCompactSupportArm(category,false,false)).toBe(false);
    expect(usesCompactSupportArm("pistol",true,true)).toBe(false);
    expect(usesCompactSupportArm("pistol",true,false)).toBe(true);
  });

  test("on all compact grips, the elbow is behind the wrist and ahead of the shoulder", () => {
    for(const aspect of [16/9,4/3,1,9/16]){
      const frame=supportArmFraming(aspect,true);
      for(const id of [
        "pistol_side","pistol_magnum","pistol_burst","pistol_machine",
        "pistol_ghost","pistol_bastion","pistol_arc",
        "pdw_mamba","pdw_sentinel","smg_kp","smg_vector","smg_compact"
      ]){
        const wrist=wristFor(id);
        const elbow=supportElbowPosition(frame.shoulder,wrist,frame.pole,
          SUPPORT_SIDEARM_UPPER_LENGTH,SUPPORT_SIDEARM_FOREARM_LENGTH);
        // In camera space -Z is toward the muzzle. Neither segment may
        // reverse direction: the shoulder is back, then elbow, then hand.
        expect(frame.shoulder[2]-elbow[2]).toBeGreaterThan(.09);
        expect(elbow[2]-wrist[2]).toBeGreaterThan(.12);
        expect(elbow[0]).toBeGreaterThan(frame.shoulder[0]);
        expect(elbow[0]).toBeLessThan(wrist[0]);
        expect(elbow[1]).toBeLessThan(wrist[1]+.01);
        const reach=dist(frame.shoulder,wrist);
        const stretch=Math.max(1,reach/((SUPPORT_SIDEARM_UPPER_LENGTH+SUPPORT_SIDEARM_FOREARM_LENGTH)*.998));
        expect(dist(frame.shoulder,elbow)).toBeCloseTo(SUPPORT_SIDEARM_UPPER_LENGTH*stretch,6);
        expect(dist(elbow,wrist)).toBeCloseTo(SUPPORT_SIDEARM_FOREARM_LENGTH*stretch,6);
      }
    }
  });

  test("rifle/sniper framing is unaffected",()=>{
    for(const aspect of [16/9,4/3,1,9/16]){
      const old=supportArmFraming(aspect);
      const compact=supportArmFraming(aspect,true);
      expect(old.shoulder[2]).toBe(-.25);
      expect(old.pole[2]).toBe(-.50);
      expect(compact.shoulder[2]).toBe(.10);
      expect(compact.pole[2]).toBe(.30);
    }
  });

  test("compact reload, ADS and sway maintain continuous connected IK",()=>{
    const frame=supportArmFraming(16/9,true);
    let previous:[number,number,number]|null=null;
    for(let n=-10;n<=10;n++){
      const base=wristFor("pistol_side");
      const wrist:[number,number,number]=[
        base[0]+n*.003, base[1]+n*.001, base[2]-n*.002,
      ];
      const elbow=supportElbowPosition(frame.shoulder,wrist,frame.pole,
        SUPPORT_SIDEARM_UPPER_LENGTH,SUPPORT_SIDEARM_FOREARM_LENGTH);
      expect(elbow.every(Number.isFinite)).toBe(true);
      if(previous) expect(dist(elbow,previous)).toBeLessThan(.02);
      previous=elbow;
    }
    for(const wrist of [[-.21,-.66,-.55],[-.17,-.14,-.85],[.45,-.36,.02],[.06,-.14,-.38]]){
      const elbow=supportElbowPosition(frame.shoulder,wrist,frame.pole,
        SUPPORT_SIDEARM_UPPER_LENGTH,SUPPORT_SIDEARM_FOREARM_LENGTH);
      expect(elbow.every(Number.isFinite)).toBe(true);
      expect(dist(frame.shoulder,elbow)+dist(elbow,wrist)).toBeGreaterThanOrEqual(dist(frame.shoulder,wrist)-1e-8);
    }
  });
});

describe("Annihilator and sniper articulated arm",()=>{
  const dist=(a:readonly number[],b:readonly number[])=>
    Math.hypot(...a.map((v,i)=>v-b[i]));
  const gripWrist=(id:string):[number,number,number]=>{
    const g=firstPersonSupportGrip(id);
    return [g[0]*1.2+.30-.045,g[1]*1.2-.18-.125,g[2]*1.2-.48+.10];
  };
  test("all heavy and precision guns use the same calibrated forearm length",()=>{
    for(const aspect of [16/9,4/3,1,9/16]){
      for(const id of ["sniper_heavy","sniper_lr","sniper_scout","dmr_heavy","lmg_heavy"]){
        const wrist=gripWrist(id),category=id.startsWith("sniper")?"sniper":
          id.startsWith("lmg")?"lmg":"dmr";
        const frame=calibratedSupportArm(category,wrist,aspect);
        const elbow=supportElbowPosition(frame.shoulder,wrist,frame.pole,
          frame.upperLength,frame.forearmLength);
        expect(elbow[2]-wrist[2]).toBeGreaterThan(.19);
        expect(elbow[1]).toBeLessThan(wrist[1]);
        expect(dist(frame.shoulder,elbow)).toBeCloseTo(frame.upperLength,6);
        expect(dist(elbow,wrist)).toBeCloseTo(frame.forearmLength,6);
        expect(frame.forearmLength).toBe(.50);
      }
    }
  });
  test("Annihilator bolt pull moves shoulder, elbow and wrist together",()=>{
    const rest=gripWrist("sniper_heavy");
    const frame=calibratedSupportArm("sniper",rest,16/9);
    const port:[number,number,number]=[.095,-.34,-.56];
    const boltBack:[number,number,number]=[.045,-.34,-.28];
    const idle=animatedSupportArm(frame,rest,rest,0,frame.upperLength,frame.forearmLength);
    const grasp=animatedSupportArm(frame,rest,port,1,frame.upperLength,frame.forearmLength);
    const pulled=animatedSupportArm(frame,rest,boltBack,1,frame.upperLength,frame.forearmLength);
    expect(dist(idle.shoulder,pulled.shoulder)).toBeGreaterThan(.08);
    expect(dist(grasp.shoulder,pulled.shoulder)).toBeGreaterThan(.025);
    expect(dist(idle.elbow,pulled.elbow)).toBeGreaterThan(.12);
    expect(dist(grasp.elbow,pulled.elbow)).toBeGreaterThan(.06);
    for(const [target,joints] of [[rest,idle],[port,grasp],[boltBack,pulled]] as const){
      const reach=dist(joints.shoulder,target);
      const stretch=Math.max(1,reach/((frame.upperLength+frame.forearmLength)*.998));
      expect(dist(joints.shoulder,joints.elbow)).toBeCloseTo(frame.upperLength*stretch,6);
      expect(dist(joints.elbow,target)).toBeCloseTo(frame.forearmLength*stretch,6);
    }
    expect(animatedSupportArm(frame,rest,boltBack,0,frame.upperLength,frame.forearmLength).shoulder)
      .toEqual(frame.shoulder);
  });
});
