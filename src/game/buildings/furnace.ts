import type { ItemType, StoneFurnace } from './types'
import { TILE_SIZE } from '../world'
import { isSmeltableInput, getSmeltingResult, getItemDrawColor } from './items'
import { getBuildingAtTile } from './tile'
import { tryInsertIntoBelt } from './belts'
import { tryInsertIntoChest } from './chest'

export function getFurnaceCoveredTiles(furnace: StoneFurnace) {
  return [
    { x: furnace.tileX, y: furnace.tileY },
    { x: furnace.tileX + 1, y: furnace.tileY },
    { x: furnace.tileX, y: furnace.tileY + 1 },
    { x: furnace.tileX + 1, y: furnace.tileY + 1 },
  ]
}

export function getFurnaceOutputTile(furnace: StoneFurnace) {
  return { x: furnace.tileX + 2, y: furnace.tileY + 1 }
}

export function tryInsertIntoFurnace(furnace: StoneFurnace, item: ItemType) {
  if (isSmeltableInput(item)) {
    if (furnace.inputCount >= furnace.inputCapacity) return false
    if (furnace.inputItem !== null && furnace.inputItem !== item) return false
    furnace.inputItem = item
    furnace.inputCount += 1
    return true
  }

  if (item === 'coal') {
    furnace.fuel += 8
    return true
  }

  if (item === 'wood') {
    furnace.fuel += 5
    return true
  }

  return false
}

export function takeOneFromFurnaceOutputInternal(furnace: StoneFurnace) {
  if (!furnace.outputItem || furnace.outputCount <= 0) return null
  const item = furnace.outputItem
  furnace.outputCount -= 1
  if (furnace.outputCount <= 0) {
    furnace.outputCount = 0
    furnace.outputItem = null
  }
  return item
}

export function updateFurnace(furnace: StoneFurnace, dt: number) {
  if (furnace.outputCount > 0) {
    const outputTile = getFurnaceOutputTile(furnace)
    const target = getBuildingAtTile(outputTile.x, outputTile.y)

    if (target?.type === 'transport_belt' && furnace.outputItem) {
      if (tryInsertIntoBelt(target, furnace.outputItem)) {
        furnace.outputCount -= 1
        if (furnace.outputCount <= 0) {
          furnace.outputCount = 0
          furnace.outputItem = null
        }
      }
    } else if (target?.type === 'wooden_chest' && furnace.outputItem) {
      const moved = tryInsertIntoChest(target, furnace.outputItem, 1)
      if (moved > 0) {
        furnace.outputCount -= moved
        if (furnace.outputCount <= 0) {
          furnace.outputCount = 0
          furnace.outputItem = null
        }
      }
    }
  }

  if (furnace.fuel <= 0) return
  if (!isSmeltableInput(furnace.inputItem)) return
  if (furnace.inputCount <= 0) return
  if (furnace.outputCount >= furnace.outputCapacity) return

  const resultItem = getSmeltingResult(furnace.inputItem)
  if (!resultItem) return
  if (furnace.outputItem !== null && furnace.outputItem !== resultItem) return

  furnace.fuel = Math.max(0, furnace.fuel - dt)
  furnace.progress += dt * 0.4

  while (furnace.progress >= 1) {
    if (furnace.fuel <= 0) {
      furnace.progress = 0
      break
    }
    if (!isSmeltableInput(furnace.inputItem) || furnace.inputCount <= 0) {
      furnace.progress = 0
      break
    }

    const currentResult = getSmeltingResult(furnace.inputItem)
    if (!currentResult) {
      furnace.progress = 0
      break
    }

    if (furnace.outputCount >= furnace.outputCapacity) {
      furnace.progress = 0.999
      break
    }
    if (furnace.outputItem !== null && furnace.outputItem !== currentResult) {
      furnace.progress = 0.999
      break
    }

    furnace.inputCount -= 1
    if (furnace.inputCount <= 0) {
      furnace.inputCount = 0
      furnace.inputItem = null
    }

    furnace.outputItem = currentResult
    furnace.outputCount += 1
    furnace.progress -= 1
  }
}

export function createStoneFurnace(tileX: number, tileY: number): StoneFurnace {
  return {
    type: 'stone_furnace',
    tileX,
    tileY,
    fuel: 0,
    progress: 0,
    inputItem: null,
    inputCount: 0,
    inputCapacity: 8,
    outputItem: null,
    outputCount: 0,
    outputCapacity: 8,
  }
}

export function drawFallbackFurnaceSprite(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  furnace: StoneFurnace,
  alpha = 1,
) {
  ctx.save()
  ctx.globalAlpha = alpha

  ctx.fillStyle = '#555'
  ctx.fillRect(screenX, screenY, TILE_SIZE * 2, TILE_SIZE * 2)

  ctx.fillStyle = '#757575'
  ctx.fillRect(screenX + 4, screenY + 4, TILE_SIZE * 2 - 8, TILE_SIZE * 2 - 8)

  ctx.fillStyle = '#2e2e2e'
  ctx.fillRect(screenX + 18, screenY + 18, 28, 24)

  const fuelRatio = Math.min(furnace.fuel / 12, 1)
  ctx.fillStyle = fuelRatio > 0 ? '#ff7043' : '#444'
  ctx.fillRect(screenX + 10, screenY + TILE_SIZE * 2 - 10, TILE_SIZE * 2 - 20, 6)

  if (furnace.outputCount > 0) {
    ctx.fillStyle = getItemDrawColor(furnace.outputItem)
    ctx.fillRect(screenX + TILE_SIZE * 2 - 20, screenY + 8, 12, 8)
  }

  ctx.restore()
}

export function drawFurnaceSprite(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  furnace: StoneFurnace,
  alpha = 1,
) {
  drawFallbackFurnaceSprite(ctx, screenX, screenY, furnace, alpha)
}