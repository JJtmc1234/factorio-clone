import { camera } from '../camera'
import { TILE_SIZE } from './types'
import { getChunkKey, getTileKey, worldToChunkCoord } from './keys'
import { getOrCreateChunk, getTileAtWorldTile } from './chunks'

const chartedChunks = new Set<string>()
const visibleTiles = new Set<string>()

export function chartChunk(chunkX: number, chunkY: number) {
  chartedChunks.add(getChunkKey(chunkX, chunkY))
  getOrCreateChunk(chunkX, chunkY)
}

export function chartStarterArea(centerTileX: number, centerTileY: number, chunkRadius = 3) {
  const cx = worldToChunkCoord(centerTileX)
  const cy = worldToChunkCoord(centerTileY)

  for (let dy = -chunkRadius; dy <= chunkRadius; dy++) {
    for (let dx = -chunkRadius; dx <= chunkRadius; dx++) {
      chartChunk(cx + dx, cy + dy)
    }
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

      visibleTiles.add(getTileKey(tileX, tileY))
      chartedChunks.add(getChunkKey(worldToChunkCoord(tileX), worldToChunkCoord(tileY)))
      getTileAtWorldTile(tileX, tileY)
    }
  }
}

export function isTileVisible(tileX: number, tileY: number) {
  return visibleTiles.has(getTileKey(tileX, tileY))
}

export function isChunkCharted(tileX: number, tileY: number) {
  return chartedChunks.has(getChunkKey(worldToChunkCoord(tileX), worldToChunkCoord(tileY)))
}

export function getVisibleTileBounds() {
  return {
    startTileX: Math.floor(camera.x / TILE_SIZE) - 1,
    startTileY: Math.floor(camera.y / TILE_SIZE) - 1,
    endTileX: Math.ceil((camera.x + camera.width) / TILE_SIZE) + 1,
    endTileY: Math.ceil((camera.y + camera.height) / TILE_SIZE) + 1,
  }
}
