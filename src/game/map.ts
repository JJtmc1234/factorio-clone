import { player } from './player'
import {
  TILE_SIZE,
  getTileAtWorldTile,
  isTileExplored
} from './world'

export const mapState = {
  open: false
}

export function toggleMap() {
  mapState.open = !mapState.open
}

function getMapColor(tile: ReturnType<typeof getTileAtWorldTile>) {
  if (tile.object?.type === 'tree') return '#2e8b57'
  if (tile.object?.type === 'ore') return '#888888'
  return '#4c8a3f'
}

export function renderMap(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number
) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.92)'
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  const mapTileSize = 6
  const tilesWide = Math.floor(canvasWidth / mapTileSize)
  const tilesHigh = Math.floor(canvasHeight / mapTileSize)

  const playerTileX = Math.floor(player.x / TILE_SIZE)
  const playerTileY = Math.floor(player.y / TILE_SIZE)

  const halfWide = Math.floor(tilesWide / 2)
  const halfHigh = Math.floor(tilesHigh / 2)

  for (let sy = 0; sy < tilesHigh; sy++) {
    for (let sx = 0; sx < tilesWide; sx++) {
      const tileX = playerTileX + (sx - halfWide)
      const tileY = playerTileY + (sy - halfHigh)

      if (!isTileExplored(tileX, tileY)) continue

      const tile = getTileAtWorldTile(tileX, tileY)

      ctx.fillStyle = getMapColor(tile)
      ctx.fillRect(
        sx * mapTileSize,
        sy * mapTileSize,
        mapTileSize,
        mapTileSize
      )
    }
  }

  // player marker in center
  ctx.fillStyle = '#ff4444'
  ctx.fillRect(
    halfWide * mapTileSize,
    halfHigh * mapTileSize,
    mapTileSize,
    mapTileSize
  )

  ctx.fillStyle = 'white'
  ctx.font = '18px sans-serif'
  ctx.fillText('MAP (M to close)', 20, 30)
}