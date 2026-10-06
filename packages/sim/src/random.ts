export function assertSeed(seed: number): void {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new Error('Seed must be uint32');
}
/** Stable uint32 seed derivation separates schedule, person, noise, events and missingness streams. */
export function deriveSeed(seed: number, label: string): number {
  assertSeed(seed);
  let hash = seed ^ 2166136261;
  for (const character of label) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return hash >>> 0;
}
export class Random {
  private state: number;
  private spare: number | undefined;
  constructor(seed: number) {
    assertSeed(seed);
    this.state = seed;
  }
  uniform(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  }
  normal(): number {
    if (this.spare !== undefined) {
      const value = this.spare;
      this.spare = undefined;
      return value;
    }
    const radius = Math.sqrt(-2 * Math.log(1 - this.uniform()));
    const angle = 2 * Math.PI * this.uniform();
    this.spare = radius * Math.sin(angle);
    return radius * Math.cos(angle);
  }
}
