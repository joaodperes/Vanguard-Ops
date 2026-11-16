import * as THREE from "three";

type Source = { light: THREE.PointLight; active: () => boolean; position: THREE.Vector3 };

/** Stable shader light count. Authored fixtures keep their geometry and their
 * logical lights (for flicker); only a fixed nearby selection reaches WebGL. */
export class WorldLightBudget {
  private sources = new Map<THREE.PointLight, Source>();
  private slots: THREE.PointLight[] = [];
  private selected: Source[] = [];
  private nextSelectionAt = -Infinity;
  private disposed = false;

  constructor(private scene: THREE.Scene, capacity: number) {
    const authored: THREE.PointLight[] = [];
    scene.traverse(node => {
      if (node instanceof THREE.PointLight && node.name !== "pooled_explosion_light") authored.push(node);
    });
    for (const light of authored) {
      light.visible = false;
      this.register(light, () => {
        for (let parent = light.parent; parent; parent = parent.parent) if (!parent.visible) return false;
        return true;
      });
    }
    // Reserve two slots for concurrent gravity fields even on sparsely lit maps.
    for (let i = 0; i < Math.min(capacity, authored.length + 2); i++) {
      const light = new THREE.PointLight(0xffffff, 0, 1);
      light.name = "pooled_world_light"; light.castShadow = false;
      scene.add(light); this.slots.push(light);
    }
  }

  register(light: THREE.PointLight, active: () => boolean): void {
    if (this.disposed) return;
    this.sources.set(light, { light, active, position: new THREE.Vector3() });
    this.nextSelectionAt = -Infinity;
  }
  remove(light: THREE.PointLight): void {
    this.sources.delete(light); this.nextSelectionAt = -Infinity;
  }
  update(now: number, listener: THREE.Vector3): void {
    if (this.disposed) return;
    if (now >= this.nextSelectionAt) {
      this.nextSelectionAt = now + 100;
      const candidates: { source: Source; score: number }[] = [];
      for (const source of this.sources.values()) {
        if (!source.active() || source.light.intensity <= 0) continue;
        source.light.getWorldPosition(source.position);
        candidates.push({ source, score: source.light.intensity / (1 + source.position.distanceToSquared(listener) / 225) });
      }
      candidates.sort((a, b) => b.score - a.score);
      this.selected = candidates.slice(0, this.slots.length).map(item => item.source);
    }
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i], source = this.selected[i];
      slot.intensity = 0;
      if (!source || !this.sources.has(source.light) || !source.active()) continue;
      source.light.getWorldPosition(slot.position);
      slot.color.copy(source.light.color); slot.intensity = source.light.intensity;
      slot.distance = source.light.distance; slot.decay = source.light.decay;
    }
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const slot of this.slots) { slot.removeFromParent(); slot.dispose(); }
    this.sources.clear(); this.selected = []; this.slots = [];
  }
}
