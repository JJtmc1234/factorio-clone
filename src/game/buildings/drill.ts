import type { BurnerDrill, Direction, ItemType } from './types'
import { TILE_SIZE, getTileAtWorldTile } from '../world'
import { getGameSprite } from '../../components/gameSprites'
import { isMineableResource, getItemDrawColor } from './items'
import { getBuildingAtTile } from './tile'
import { tryInsertIntoChest, consumeCoalFromChest } from './chest'
import { tryInsertIntoBelt } from './belts'
import { tryInsertIntoFurnace } from './furnace'
import { drawDirectionMarker, drawSpriteRotated } from './sprite'

export function getDrillCoveredTiles(drill: BurnerDrill) {
  return [
    { x: drill.tileX, y: drill.tileY },
    { x: drill.tileX + 1, y: drill.tileY },
    { x: drill.tileX, y: drill.tileY + 1 },
    { x: drill.tileX + 1, y: drill.tileY + 1 },
  ]
}

export function getDrillMiningTile(drill: BurnerDrill) {
  for (const tilePos of getDrillCoveredTiles(drill)) {
    const tile = getTileAtWorldTile(tilePos.x, tilePos.y)
    if (tile.object && isMineableResource(tile.object.type)) {
      return tilePos
    }
  }
  return null
}

export function getDrillOutputTile(drill: BurnerDrill) {
  if (drill.direction === 'up') return { x: drill.tileX + 1, y: drill.tileY - 1 }
  if (drill.direction === 'right') return { x: drill.tileX + 2, y: drill.tileY + 1 }
  if (drill.direction === 'down') return { x: drill.tileX + 1, y: drill.tileY + 2 }
  return { x: drill.tileX - 1, y: drill.tileY + 1 }
}

export function takeOneFromDrillOutputInternal(drill: BurnerDrill) {
  if (!drill.outputItem || drill.outputCount <= 0) return null
  const item = drill.outputItem
  drill.outputCount -= 1
  if (drill.outputCount <= 0) {
    drill.outputCount = 0
    drill.outputItem = null
  }
  return item
}

export function canAcceptDrillOutput(drill: BurnerDrill, item: ItemType) {
  if (drill.outputCount >= drill.outputCapacity) return false
  if (drill.outputItem === null) return true
  return drill.outputItem === item
}

export function addDrillOutput(drill: BurnerDrill, item: ItemType) {
  if (!canAcceptDrillOutput(drill, item)) return false

  if (drill.outputItem === null) {
    drill.outputItem = item
  }

  drill.outputCount += 1
  return true
}

export function drawFallbackBurnerDrillSprite(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  drill: BurnerDrill,
  alpha = 1,
) {
  ctx.save()
  ctx.globalAlpha = alpha

  ctx.fillStyle = '#6d4c41'
  ctx.fillRect(screenX, screenY, TILE_SIZE * 2, TILE_SIZE * 2)

  ctx.fillStyle = '#8d6e63'
  ctx.fillRect(screenX + 4, screenY + 4, TILE_SIZE * 2 - 8, TILE_SIZE * 2 - 8)

  drawDirectionMarker(ctx, screenX, screenY, drill.direction, TILE_SIZE * 2)

  ctx.fillStyle = 'black'
  ctx.fillRect(screenX + 8, screenY + TILE_SIZE * 2 - 10, TILE_SIZE * 2 - 16, 6)

  const fuelRatio = Math.min(drill.fuel / 12, 1)
  ctx.fillStyle = fuelRatio > 0 ? '#ff9800' : '#555'
  ctx.fillRect(screenX + 8, screenY + TILE_SIZE * 2 - 10, (TILE_SIZE * 2 - 16) * fuelRatio, 6)

  if (drill.outputCount > 0) {
    ctx.fillStyle = getItemDrawColor(drill.outputItem)
    ctx.fillRect(screenX + 12, screenY + TILE_SIZE * 2 - 24, 12, 8)
  }

  ctx.restore()
}

export function consumeCoalFromDrill(drill: BurnerDrill) {
  if (drill.outputItem !== 'coal' || drill.outputCount <= 0) return false

  drill.outputCount -= 1
  if (drill.outputCount <= 0) {
    drill.outputCount = 0
    drill.outputItem = null
  }

  return true
}

export function tryAutoFuelDrill(drill: BurnerDrill) {
  if (drill.fuel > 1.5) return

  const outputTile = getDrillOutputTile(drill)
  const target = getBuildingAtTile(outputTile.x, outputTile.y)

  if (!target) return

  if (target.type === 'wooden_chest' && consumeCoalFromChest(target)) {
    drill.fuel += 8
    return
  }

  if (target.type === 'burner_drill' && consumeCoalFromDrill(target)) {
    drill.fuel += 8
  }
}

export function tryPushDrillOutput(drill: BurnerDrill) {
  if (!drill.outputItem || drill.outputCount <= 0) return

  const outputTile = getDrillOutputTile(drill)
  const target = getBuildingAtTile(outputTile.x, outputTile.y)

  if (!target) return

  if (target.type === 'wooden_chest') {
    const moved = tryInsertIntoChest(target, drill.outputItem, 1)
    if (moved > 0) {
      drill.outputCount -= moved
      if (drill.outputCount <= 0) {
        drill.outputCount = 0
        drill.outputItem = null
      }
    }
    return
  }

  if (target.type === 'transport_belt') {
    if (tryInsertIntoBelt(target, drill.outputItem)) {
      drill.outputCount -= 1
      if (drill.outputCount <= 0) {
        drill.outputCount = 0
        drill.outputItem = null
      }
    }
    return
  }

  if (target.type === 'stone_furnace') {
    if (tryInsertIntoFurnace(target, drill.outputItem)) {
      drill.outputCount -= 1
      if (drill.outputCount <= 0) {
        drill.outputCount = 0
        drill.outputItem = null
      }
    }
    return
  }

  if (target.type === 'burner_drill' && drill.outputItem === 'coal' && target.fuel <= 5) {
    drill.outputCount -= 1
    if (drill.outputCount <= 0) {
      drill.outputCount = 0
      drill.outputItem = null
    }
    target.fuel += 8
  }
}

export function createBurnerDrill(tileX: number, tileY: number, direction: Direction): BurnerDrill {
  return {
    type: 'burner_drill',
    tileX,
    tileY,
    direction,
    fuel: 0,
    progress: 0,
    outputItem: null,
    outputCount: 0,
    outputCapacity: 8,
  }
}

export function getDrillRotation(direction: Direction) {
  if (direction === 'right') return 0
  if (direction === 'down') return Math.PI / 2
  if (direction === 'left') return Math.PI
  return -Math.PI / 2
}

export function drawBurnerDrillSprite(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  drill: BurnerDrill,
  alpha = 1,
) {
  const sprite = getGameSprite('burner_drill')
  const size = TILE_SIZE * 2

  if (sprite && sprite.complete && sprite.naturalWidth > 0) {
    drawSpriteRotated(
      ctx,
      sprite,
      screenX,
      screenY,
      size,
      size,
      getDrillRotation(drill.direction),
      alpha,
    )

    ctx.save()
    ctx.globalAlpha = alpha

    ctx.fillStyle = 'black'
    ctx.fillRect(screenX + 8, screenY + size - 10, size - 16, 6)

    const fuelRatio = Math.min(drill.fuel / 12, 1)
    ctx.fillStyle = fuelRatio > 0 ? '#ff9800' : '#555'
    ctx.fillRect(screenX + 8, screenY + size - 10, (size - 16) * fuelRatio, 6)

    if (drill.outputCount > 0) {
      ctx.fillStyle = getItemDrawColor(drill.outputItem)
      ctx.fillRect(screenX + 12, screenY + size - 24, 12, 8)
    }

    ctx.restore()
    return
  }

  drawFallbackBurnerDrillSprite(ctx, screenX, screenY, drill, alpha)
}