import type { Biome } from './types'

export function hash(x: number, y: number, seed: number): number {
  let n = x * 374761393 + y * 668265263 + seed * 1442695041
  n = (n ^ (n >> 13)) * 1274126177
  n = n ^ (n >> 16)
  return (n >>> 0) / 4294967295
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

function valueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = smoothstep(x - x0)
  const fy = smoothstep(y - y0)

  const n00 = hash(x0, y0, seed)
  const n10 = hash(x0 + 1, y0, seed)
  const n01 = hash(x0, y0 + 1, seed)
  const n11 = hash(x0 + 1, y0 + 1, seed)

  const ix0 = n00 + (n10 - n00) * fx
  const ix1 = n01 + (n11 - n01) * fx
  return ix0 + (ix1 - ix0) * fy
}

export function fbm(x: number, y: number, seed: number, octaves = 4): number {
  let total = 0
  let amp = 1
  let freq = 1
  let max = 0

  for (let i = 0; i < octaves; i++) {
    total += valueNoise(x * freq, y * freq, seed + i * 17) * amp
    max += amp
    amp *= 0.5
    freq *= 2
  }

  return total / max
}

const BIOME_SEED = 1337
const TREE_SEED = 4242
const BIOME_SCALE = 28
export const TREE_SCALE = 9
export { TREE_SEED }

export function biomeForTile(tileX: number, tileY: number): Biome {
  const m = fbm(tileX / BIOME_SCALE, tileY / BIOME_SCALE, BIOME_SEED, 4)
  if (m < 0.40) return 'dirt'
  if (m < 0.56) return 'grass'
  return 'grass_lush'
}

export function treePlacementChance(biome: Biome, treeNoise: number): number {
  if (biome === 'grass_lush') {
    if (treeNoise > 0.45) return 0.75
    if (treeNoise > 0.35) return 0.3
    return 0
  }

  if (biome === 'grass') {
    if (treeNoise > 0.5) return 0.45
    if (treeNoise > 0.4) return 0.12
    return 0
  }

  // dirt: occasional dead trees at the edges of forests
  if (treeNoise > 0.55) return 0.06
  return 0
}
