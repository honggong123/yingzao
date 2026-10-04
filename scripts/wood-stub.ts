import * as THREE from 'three'
export function makeWoodMaterial(_opts?: unknown): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial()
}
export interface WoodOptions {
  tone?: number
}
