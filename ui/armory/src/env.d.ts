declare module '*voxel-armory-preview.js' {
  export function createWeaponPreview(canvas: HTMLCanvasElement, options: {
    weaponId: string; kind: 'gun' | 'melee'; reducedMotion?: boolean; onError?(): void;
  }): Promise<{ setWeapon(id: string, kind?: 'gun' | 'melee'): void; reset(): void; destroy(): void }>;
}
