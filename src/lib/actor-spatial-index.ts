import type { Vec3 } from "./game-protocol";

/** Live actor references, rebuilt once per bot pass and updated after each
 * actor moves. Original roster order is retained for ties and separation. */
export class ActorSpatialIndex<T extends { id: string; pos: Vec3 }> {
  private cells = new Map<string, Map<string, T>>();
  private locations = new Map<string, string>();
  private order = new Map<string, number>();
  constructor(private readonly cellSize = 16) {
    if(!Number.isFinite(cellSize)||cellSize<=0)throw new RangeError("cellSize must be positive");
  }

  get size(): number { return this.locations.size; }

  rebuild(actors: Iterable<T>): void {
    this.cells.clear(); this.locations.clear(); this.order.clear();
    for (const actor of actors) this.update(actor);
  }

  update(actor: T): void {
    const key = Math.floor(actor.pos[0] / this.cellSize) + "," + Math.floor(actor.pos[2] / this.cellSize);
    const old = this.locations.get(actor.id);
    if (old && old !== key) {
      const cell = this.cells.get(old)!;
      cell.delete(actor.id);
      if (!cell.size) this.cells.delete(old);
    }
    let cell = this.cells.get(key);
    if (!cell) { cell = new Map(); this.cells.set(key, cell); }
    cell.set(actor.id, actor); this.locations.set(actor.id, key);
    if (!this.order.has(actor.id)) this.order.set(actor.id, this.order.size);
  }

  near(x: number, z: number, radius: number): T[] {
    if(!Number.isFinite(x)||!Number.isFinite(z)||Number.isNaN(radius)||radius<0)return [];
    if(!Number.isFinite(radius))return [...this.cells.values()].flatMap(cell=>[...cell.values()])
      .sort((a,b)=>this.order.get(a.id)!-this.order.get(b.id)!);
    const actors: T[] = [], size = this.cellSize;
    const width=Math.floor((x+radius)/size)-Math.floor((x-radius)/size)+1;
    const depth=Math.floor((z+radius)/size)-Math.floor((z-radius)/size)+1;
    if(![Math.floor((x-radius)/size),Math.floor((x+radius)/size),Math.floor((z-radius)/size),Math.floor((z+radius)/size)].every(Number.isSafeInteger)||
        width*depth>this.cells.size*2)return [...this.cells.values()].flatMap(cell=>[...cell.values()])
      .filter(actor=>Math.abs(actor.pos[0]-x)<=radius&&Math.abs(actor.pos[2]-z)<=radius)
      .sort((a,b)=>this.order.get(a.id)!-this.order.get(b.id)!);
    for (let cx = Math.floor((x - radius) / size); cx <= Math.floor((x + radius) / size); cx++)
      for (let cz = Math.floor((z - radius) / size); cz <= Math.floor((z + radius) / size); cz++)
        for (const actor of this.cells.get(cx + "," + cz)?.values() ?? [])
          if (Math.abs(actor.pos[0] - x) <= radius && Math.abs(actor.pos[2] - z) <= radius) actors.push(actor);
    return actors.sort((a, b) => this.order.get(a.id)! - this.order.get(b.id)!);
  }
}
