import { CHUNK_SIZE } from './types'

export function getChunkKey(chunkX: number, chunkY: number): string {
  return `${chunkX},${chunkY}`
}

export function getTileKey(tileX: number, tileY: number): string {
  return `${tileX},${tileY}`
}

export function worldToChunkCoord(tileCoord: number): number {
  return Math.floor(tileCoord / CHUNK_SIZE)
}

export function mod(n: number, m: number): number {
  return ((n % m) + m) % m
}
