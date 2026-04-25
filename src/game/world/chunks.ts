import { screenToWorld } from '../camera'
import type { Chunk, Tile } from './types'
import { CHUNK_SIZE, TILE_SIZE } from './types'
import { getChunkKey, mod, worldToChunkCoord } from './keys'
import { generateChunk } from './generation'

const chunks = new Map<string, Chunk>()

export function getOrCreateChunk(chunkX: number, chunkY: number): Chunk {
  const key = getChunkKey(chunkX, chunkY)
  let chunk = chunks.get(key)

  if (!chunk) {
    chunk = generateChunk(chunkX, chunkY)
    chunks.set(key, chunk)
  }

  return chunk
}

export function getTileAtWorldTile(tileX: number, tileY: number): Tile {
  const chunkX = worldToChunkCoord(tileX)
  const chunkY = worldToChunkCoord(tileY)

  const localX = mod(tileX, CHUNK_SIZE)
  const localY = mod(tileY, CHUNK_SIZE)

  const chunk = getOrCreateChunk(chunkX, chunkY)
  return chunk.tiles[localY][localX]
}

export function getTileCoordsAtScreenPosition(screenX: number, screenY: number) {
  const world = screenToWorld(screenX, screenY)

  return {
    tileX: Math.floor(world.x / TILE_SIZE),
    tileY: Math.floor(world.y / TILE_SIZE),
  }
}

export function getTileAtScreenPosition(screenX: number, screenY: number) {
  const { tileX, tileY } = getTileCoordsAtScreenPosition(screenX, screenY)

  return {
    tileX,
    tileY,
    tile: getTileAtWorldTile(tileX, tileY),
  }
}
