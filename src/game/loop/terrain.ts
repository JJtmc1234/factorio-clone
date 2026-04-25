import { worldToScreen } from '../camera'
import { TILE_SIZE, getTileAtWorldTile, getVisibleTileBounds } from '../world'

const BIOME_COLORS: Record<string, string> = {
  dirt: '#8b6c40',
  grass: '#4c8a3f',
  grass_lush: '#3a6f2c',
}

export function drawTerrain(ctx: CanvasRenderingContext2D) {
  const bounds = getVisibleTileBounds()

  for (let tileY = bounds.startTileY; tileY <= bounds.endTileY; tileY++) {
    for (let tileX = bounds.startTileX; tileX <= bounds.endTileX; tileX++) {
      const screen = worldToScreen(tileX * TILE_SIZE, tileY * TILE_SIZE)
      const tile = getTileAtWorldTile(tileX, tileY)

      ctx.fillStyle = BIOME_COLORS[tile.biome] ?? '#4c8a3f'
      ctx.fillRect(screen.x, screen.y, TILE_SIZE, TILE_SIZE)
    }
  }
}

export function drawGrid(ctx: CanvasRenderingContext2D) {
  const bounds = getVisibleTileBounds()

  ctx.strokeStyle = '#333'

  for (let tileY = bounds.startTileY; tileY <= bounds.endTileY; tileY++) {
    for (let tileX = bounds.startTileX; tileX <= bounds.endTileX; tileX++) {
      const screen = worldToScreen(tileX * TILE_SIZE, tileY * TILE_SIZE)
      ctx.strokeRect(screen.x, screen.y, TILE_SIZE, TILE_SIZE)
    }
  }
}

export function drawObjects(ctx: CanvasRenderingContext2D) {
  const bounds = getVisibleTileBounds()

  for (let tileY = bounds.startTileY; tileY <= bounds.endTileY; tileY++) {
    for (let tileX = bounds.startTileX; tileX <= bounds.endTileX; tileX++) {
      const tile = getTileAtWorldTile(tileX, tileY)
      const object = tile.object
      if (!object) continue

      const screen = worldToScreen(tileX * TILE_SIZE, tileY * TILE_SIZE)

      if (object.type === 'tree') {
        ctx.fillStyle = '#6b4f2a'
        ctx.fillRect(screen.x + 13, screen.y + 16, 6, 10)

        ctx.fillStyle = '#2e8b57'
        ctx.fillRect(screen.x + 8, screen.y + 7, 16, 10)
        ctx.fillRect(screen.x + 6, screen.y + 12, 8, 8)
        ctx.fillRect(screen.x + 18, screen.y + 12, 8, 8)
      } else if (object.type === 'iron_ore') {
        // cool blue-grey
        ctx.fillStyle = '#3a4a5e'
        ctx.fillRect(screen.x + 6, screen.y + 8, 20, 16)

        ctx.fillStyle = '#7a8aa3'
        ctx.fillRect(screen.x + 9, screen.y + 10, 5, 5)
        ctx.fillRect(screen.x + 16, screen.y + 13, 4, 4)
        ctx.fillRect(screen.x + 20, screen.y + 10, 3, 3)
      } else if (object.type === 'copper_ore') {
        ctx.fillStyle = '#7a4a1f'
        ctx.fillRect(screen.x + 6, screen.y + 8, 20, 16)

        ctx.fillStyle = '#c98046'
        ctx.fillRect(screen.x + 9, screen.y + 10, 5, 5)
        ctx.fillRect(screen.x + 16, screen.y + 13, 4, 4)
        ctx.fillRect(screen.x + 20, screen.y + 10, 3, 3)
      } else if (object.type === 'stone') {
        // warm tan-grey
        ctx.fillStyle = '#776550'
        ctx.fillRect(screen.x + 6, screen.y + 8, 20, 16)

        ctx.fillStyle = '#b8a487'
        ctx.fillRect(screen.x + 9, screen.y + 10, 5, 5)
        ctx.fillRect(screen.x + 16, screen.y + 13, 4, 4)
        ctx.fillRect(screen.x + 20, screen.y + 10, 3, 3)
      } else if (object.type === 'coal') {
        ctx.fillStyle = '#1e1e22'
        ctx.fillRect(screen.x + 6, screen.y + 8, 20, 16)

        ctx.fillStyle = '#3a3a40'
        ctx.fillRect(screen.x + 10, screen.y + 11, 4, 3)
        ctx.fillRect(screen.x + 17, screen.y + 14, 3, 3)
        ctx.fillRect(screen.x + 20, screen.y + 10, 3, 2)
      }
    }
  }
}
