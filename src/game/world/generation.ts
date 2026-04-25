import type { Chunk, Tile, WorldObjectType } from './types'
import { CHUNK_SIZE } from './types'
import { biomeForTile, fbm, hash, treePlacementChance, TREE_SCALE, TREE_SEED } from './noise'

function createEmptyChunk(chunkX: number, chunkY: number): Chunk {
  const tiles: Tile[][] = []

  for (let y = 0; y < CHUNK_SIZE; y++) {
    const row: Tile[] = []

    for (let x = 0; x < CHUNK_SIZE; x++) {
      row.push({ object: null, biome: 'grass' })
    }

    tiles.push(row)
  }

  return { chunkX, chunkY, tiles }
}

function paintPatch(
  chunk: Chunk,
  chunkX: number,
  chunkY: number,
  centerX: number,
  centerY: number,
  radius: number,
  minAmount: number,
  maxAmount: number,
  resourceType: WorldObjectType,
) {
  const wobbleSeed =
    resourceType === 'iron_ore'
      ? 5101
      : resourceType === 'copper_ore'
        ? 5202
        : resourceType === 'coal'
          ? 5303
          : 5404

  for (let localY = 0; localY < CHUNK_SIZE; localY++) {
    for (let localX = 0; localX < CHUNK_SIZE; localX++) {
      const worldTileX = chunkX * CHUNK_SIZE + localX
      const worldTileY = chunkY * CHUNK_SIZE + localY

      const dx = worldTileX - centerX
      const dy = worldTileY - centerY
      const dist = Math.sqrt(dx * dx + dy * dy)

      const wobble =
        (fbm(worldTileX / 4, worldTileY / 4, wobbleSeed, 3) - 0.5) * radius * 0.55
      if (dist > radius + wobble) continue

      const tile = chunk.tiles[localY][localX]
      if (tile.object) continue

      const normalizedDist = Math.min(1, Math.max(0, dist / radius))
      const base = minAmount + (maxAmount - minAmount) * (1 - normalizedDist)
      const jitter = 0.85 + hash(worldTileX, worldTileY, 9001) * 0.3
      const amount = Math.max(minAmount, Math.floor(base * jitter))

      tile.object = {
        type: resourceType,
        amount,
      }
    }
  }
}

export function generateChunk(chunkX: number, chunkY: number): Chunk {
  const chunk = createEmptyChunk(chunkX, chunkY)

  for (let localY = 0; localY < CHUNK_SIZE; localY++) {
    for (let localX = 0; localX < CHUNK_SIZE; localX++) {
      const worldTileX = chunkX * CHUNK_SIZE + localX
      const worldTileY = chunkY * CHUNK_SIZE + localY
      const tile = chunk.tiles[localY][localX]

      const biome = biomeForTile(worldTileX, worldTileY)
      tile.biome = biome

      const treeNoise = fbm(worldTileX / TREE_SCALE, worldTileY / TREE_SCALE, TREE_SEED, 3)
      const chance = treePlacementChance(biome, treeNoise)

      if (chance > 0 && hash(worldTileX, worldTileY, 11) < chance) {
        tile.object = { type: 'tree', amount: 1 }
      }
    }
  }

  // Guaranteed starting resource patches near spawn (~300k total each, edge ≥ ~100, center ≥ ~3000).
  paintPatch(chunk, chunkX, chunkY, -8, 2, 8, 120, 4000, 'iron_ore')
  paintPatch(chunk, chunkX, chunkY, 8, 1, 7, 100, 3500, 'coal')
  paintPatch(chunk, chunkX, chunkY, 3, 8, 7, 100, 3500, 'copper_ore')
  paintPatch(chunk, chunkX, chunkY, -4, -8, 6, 80, 2500, 'stone')

  // Random resource patches across the world. Patches farther from spawn are bigger and richer.
  for (let patchChunkY = chunkY - 1; patchChunkY <= chunkY + 1; patchChunkY++) {
    for (let patchChunkX = chunkX - 1; patchChunkX <= chunkX + 1; patchChunkX++) {
      const patchRoll = hash(patchChunkX, patchChunkY, 2)
      if (patchRoll >= 0.18) continue

      const patchCenterX =
        patchChunkX * CHUNK_SIZE + Math.floor(hash(patchChunkX, patchChunkY, 3) * CHUNK_SIZE)
      const patchCenterY =
        patchChunkY * CHUNK_SIZE + Math.floor(hash(patchChunkX, patchChunkY, 4) * CHUNK_SIZE)

      const distFromSpawn = Math.hypot(patchCenterX, patchCenterY) / CHUNK_SIZE
      const richnessFactor = 1 + distFromSpawn * 0.18
      const sizeFactor = 1 + distFromSpawn * 0.06

      const baseRadius = 7 + Math.floor(hash(patchChunkX, patchChunkY, 5) * 7)
      const radius = Math.min(28, Math.floor(baseRadius * sizeFactor))

      const minAmount = Math.floor(120 * richnessFactor)
      const maxAmount = Math.floor(
        (2500 + hash(patchChunkX, patchChunkY, 6) * 2500) * richnessFactor,
      )

      const resourceRoll = hash(patchChunkX, patchChunkY, 7)

      let resourceType: WorldObjectType
      if (resourceRoll < 0.4) {
        resourceType = 'iron_ore'
      } else if (resourceRoll < 0.65) {
        resourceType = 'coal'
      } else if (resourceRoll < 0.85) {
        resourceType = 'copper_ore'
      } else {
        resourceType = 'stone'
      }

      paintPatch(
        chunk,
        chunkX,
        chunkY,
        patchCenterX,
        patchCenterY,
        radius,
        minAmount,
        maxAmount,
        resourceType,
      )
    }
  }

  return chunk
}
