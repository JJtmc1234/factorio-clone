import { worldToScreen } from './camera'
import { addItem, removeItem } from './inventory'
import { TILE_SIZE, getTileAtWorldTile, isTileExplored, isTileVisible } from './world'

export interface BurnerDrill {
  type: 'burner_drill'
  tileX: number
  tileY: number
  fuel: number
  progress: number
}

const drills = new Map<string, BurnerDrill>()

function getKey(tileX: number, tileY: number) {
  return `${tileX},${tileY}`
}

export function getBuildingAtTile(tileX: number, tileY: number) {
  return drills.get(getKey(tileX, tileY)) ?? null
}

export function placeBurnerDrill(tileX: number, tileY: number) {
  if (getBuildingAtTile(tileX, tileY)) {
    return false
  }

  const tile = getTileAtWorldTile(tileX, tileY)
  if (!tile.object || tile.object.type !== 'ore') {
    return false
  }

  drills.set(getKey(tileX, tileY), {
    type: 'burner_drill',
    tileX,
    tileY,
    fuel: 0,
    progress: 0,
  })

  return true
}

export function fuelBuildingAtTile(tileX: number, tileY: number) {
  const building = getBuildingAtTile(tileX, tileY)
  if (!building) {
    return false
  }

  if (!removeItem('wood', 1)) {
    return false
  }

  building.fuel += 5
  return true
}

export function updateBuildings(dt: number) {
  for (const drill of drills.values()) {
    const tile = getTileAtWorldTile(drill.tileX, drill.tileY)

    if (drill.fuel <= 0) {
      continue
    }

    if (!tile.object || tile.object.type !== 'ore') {
      continue
    }

    drill.fuel = Math.max(0, drill.fuel - dt)
    drill.progress += dt * 0.35

    while (drill.progress >= 1) {
      const currentTile = getTileAtWorldTile(drill.tileX, drill.tileY)

      if (!currentTile.object || currentTile.object.type !== 'ore') {
        drill.progress = 0
        break
      }

      addItem('iron_ore', 1)
      currentTile.object.amount -= 1
      drill.progress -= 1

      if (currentTile.object.amount <= 0) {
        currentTile.object = null
        drill.progress = 0
        break
      }
    }
  }
}

export function renderBuildings(ctx: CanvasRenderingContext2D) {
  for (const drill of drills.values()) {
    if (!isTileExplored(drill.tileX, drill.tileY)) {
      continue
    }

    const screen = worldToScreen(drill.tileX * TILE_SIZE, drill.tileY * TILE_SIZE)

    ctx.fillStyle = '#8b5a2b'
    ctx.fillRect(screen.x + 4, screen.y + 4, 24, 24)

    ctx.fillStyle = '#444'
    ctx.fillRect(screen.x + 10, screen.y + 10, 12, 12)

    ctx.fillStyle = 'black'
    ctx.fillRect(screen.x + 4, screen.y + 26, 24, 4)

    const fuelRatio = Math.min(drill.fuel / 5, 1)
    ctx.fillStyle = fuelRatio > 0 ? 'orange' : '#555'
    ctx.fillRect(screen.x + 4, screen.y + 26, 24 * fuelRatio, 4)

    if (!isTileVisible(drill.tileX, drill.tileY)) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
      ctx.fillRect(screen.x, screen.y, TILE_SIZE, TILE_SIZE)
    }
  }
}