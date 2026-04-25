import { player } from './player'
import { TILE_SIZE, getTileAtWorldTile, isChunkCharted } from './world'

export const mapState = {
  open: false,
}

export function toggleMap() {
  mapState.open = !mapState.open
}

function getMapColor(tile: ReturnType<typeof getTileAtWorldTile>) {
  if (tile.object?.type === 'tree') return '#2e6d3a'
  if (tile.object?.type === 'iron_ore') return '#5a708a'
  if (tile.object?.type === 'copper_ore') return '#b87333'
  if (tile.object?.type === 'stone') return '#a89274'
  if (tile.object?.type === 'coal') return '#222222'
  if (tile.biome === 'dirt') return '#8b6c40'
  if (tile.biome === 'grass_lush') return '#3a6f2c'
  return '#4c8a3f'
}

export function renderMap(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
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

      if (!isChunkCharted(tileX, tileY)) continue

      const tile = getTileAtWorldTile(tileX, tileY)

      ctx.fillStyle = getMapColor(tile)
      ctx.fillRect(sx * mapTileSize, sy * mapTileSize, mapTileSize, mapTileSize)
    }
  }

  ctx.fillStyle = '#ff4444'
  ctx.fillRect(halfWide * mapTileSize, halfHigh * mapTileSize, mapTileSize, mapTileSize)

  ctx.fillStyle = 'white'
  ctx.font = '18px sans-serif'
  ctx.fillText('MAP (M to close)', 20, 30)
}