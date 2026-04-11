import { camera, screenToWorld } from './camera'

export type WorldObjectType = 'tree' | 'iron_ore' | 'coal'

export interface WorldObject {
  type: WorldObjectType
  amount: number
}

export interface Tile {
  object: WorldObject | null
}

export interface Chunk {
  chunkX: number
  chunkY: number
  tiles: Tile[][]
}

export const TILE_SIZE = 32
export const CHUNK_SIZE = 32

const chunks = new Map<string, Chunk>()
const exploredTiles = new Set<string>()
const visibleTiles = new Set<string>()

function getChunkKey(chunkX: number, chunkY: number): string {
  return `${chunkX},${chunkY}`
}

function getTileKey(tileX: number, tileY: number): string {
  return `${tileX},${tileY}`
}

function createEmptyChunk(chunkX: number, chunkY: number): Chunk {
  const tiles: Tile[][] = []

  for (let y = 0; y < CHUNK_SIZE; y++) {
    const row: Tile[] = []

    for (let x = 0; x < CHUNK_SIZE; x++) {
      row.push({ object: null })
    }

    tiles.push(row)
  }

  return { chunkX, chunkY, tiles }
}

function hash(x: number, y: number, seed: number): number {
  let n = x * 374761393 + y * 668265263 + seed * 1442695041
  n = (n ^ (n >> 13)) * 1274126177
  n = n ^ (n >> 16)
  return (n >>> 0) / 4294967295
}

function worldToChunkCoord(tileCoord: number): number {
  return Math.floor(tileCoord / CHUNK_SIZE)
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m
}

function paintPatch(
  chunk: Chunk,
  chunkX: number,
  chunkY: number,
  centerX: number,
  centerY: number,
  radius: number,
  richness: number,
  resourceType: WorldObjectType,
) {
  for (let localY = 0; localY < CHUNK_SIZE; localY++) {
    for (let localX = 0; localX < CHUNK_SIZE; localX++) {
      const worldTileX = chunkX * CHUNK_SIZE + localX
      const worldTileY = chunkY * CHUNK_SIZE + localY

      const dx = worldTileX - centerX
      const dy = worldTileY - centerY
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist > radius) continue

      const amount = Math.max(1, Math.floor(richness * (1 - dist / radius) * 3))

      chunk.tiles[localY][localX].object = {
        type: resourceType,
        amount,
      }
    }
  }
}

function generateChunk(chunkX: number, chunkY: number): Chunk {
  const chunk = createEmptyChunk(chunkX, chunkY)

  for (let localY = 0; localY < CHUNK_SIZE; localY++) {
    for (let localX = 0; localX < CHUNK_SIZE; localX++) {
      const worldTileX = chunkX * CHUNK_SIZE + localX
      const worldTileY = chunkY * CHUNK_SIZE + localY

      const treeChance = hash(worldTileX, worldTileY, 1)
      if (treeChance < 0.04) {
        chunk.tiles[localY][localX].object = { type: 'tree', amount: 1 }
      }
    }
  }

  // Guaranteed starting resource patches near spawn.
  // Spawn is around tile (0, 0), so these should be visible pretty quickly.
  paintPatch(chunk, chunkX, chunkY, -6, 2, 6, 8, 'iron_ore')
  paintPatch(chunk, chunkX, chunkY, 7, 1, 5, 8, 'coal')

  // Random resource patches across the world.
  for (let patchChunkY = chunkY - 1; patchChunkY <= chunkY + 1; patchChunkY++) {
    for (let patchChunkX = chunkX - 1; patchChunkX <= chunkX + 1; patchChunkX++) {
      const patchRoll = hash(patchChunkX, patchChunkY, 2)
      if (patchRoll >= 0.75) continue

      const patchCenterX =
        patchChunkX * CHUNK_SIZE + Math.floor(hash(patchChunkX, patchChunkY, 3) * CHUNK_SIZE)
      const patchCenterY =
        patchChunkY * CHUNK_SIZE + Math.floor(hash(patchChunkX, patchChunkY, 4) * CHUNK_SIZE)

      const radius = 4 + Math.floor(hash(patchChunkX, patchChunkY, 5) * 5)
      const richness = 3 + Math.floor(hash(patchChunkX, patchChunkY, 6) * 6)
      const resourceRoll = hash(patchChunkX, patchChunkY, 7)
      const resourceType: WorldObjectType = resourceRoll < 0.68 ? 'iron_ore' : 'coal'

      paintPatch(chunk, chunkX, chunkY, patchCenterX, patchCenterY, radius, richness, resourceType)
    }
  }

  return chunk
}

function getOrCreateChunk(chunkX: number, chunkY: number): Chunk {
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

export function updateVisibility(playerX: number, playerY: number, radiusTiles = 10) {
  visibleTiles.clear()

  const playerTileX = Math.floor(playerX / TILE_SIZE)
  const playerTileY = Math.floor(playerY / TILE_SIZE)

  for (let dy = -radiusTiles; dy <= radiusTiles; dy++) {
    for (let dx = -radiusTiles; dx <= radiusTiles; dx++) {
      if (dx * dx + dy * dy > radiusTiles * radiusTiles) continue

      const tileX = playerTileX + dx
      const tileY = playerTileY + dy
      const key = getTileKey(tileX, tileY)

      visibleTiles.add(key)
      exploredTiles.add(key)
      getTileAtWorldTile(tileX, tileY)
    }
  }
}

export function isTileVisible(tileX: number, tileY: number) {
  return visibleTiles.has(getTileKey(tileX, tileY))
}

export function isTileExplored(tileX: number, tileY: number) {
  return exploredTiles.has(getTileKey(tileX, tileY))
}

export function getVisibleTileBounds() {
  return {
    startTileX: Math.floor(camera.x / TILE_SIZE) - 1,
    startTileY: Math.floor(camera.y / TILE_SIZE) - 1,
    endTileX: Math.ceil((camera.x + camera.width) / TILE_SIZE) + 1,
    endTileY: Math.ceil((camera.y + camera.height) / TILE_SIZE) + 1,
  }
}