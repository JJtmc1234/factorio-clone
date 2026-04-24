import type { Direction, ItemType, TransportBelt } from './types'
import { TILE_SIZE } from '../world'
import { getItemDrawColor } from './items'
import { getFrontTile, getBuildingAtTile } from './tile'
import { tryInsertIntoChest } from './chest'
import { tryInsertIntoFurnace } from './furnace'
import { drawDirectionMarker } from './sprite'

export function tryInsertIntoBelt(belt: TransportBelt, item: ItemType) {
  if (belt.item !== null) return false
  belt.item = item
  belt.itemProgress = 0
  return true
}

export function updateBelt(belt: TransportBelt, dt: number) {
  if (!belt.item) return

  belt.itemProgress += dt * 2.2
  if (belt.itemProgress < 1) return

  const nextTile = getFrontTile(belt.tileX, belt.tileY, belt.direction)
  const target = getBuildingAtTile(nextTile.x, nextTile.y)

  if (!target) {
    belt.itemProgress = 1
    return
  }

  if (target.type === 'transport_belt') {
    if (target.item === null) {
      target.item = belt.item
      target.itemProgress = 0
      belt.item = null
      belt.itemProgress = 0
    } else {
      belt.itemProgress = 1
    }
    return
  }

  if (target.type === 'wooden_chest') {
    const moved = tryInsertIntoChest(target, belt.item, 1)
    if (moved > 0) {
      belt.item = null
      belt.itemProgress = 0
    } else {
      belt.itemProgress = 1
    }
    return
  }

  if (target.type === 'stone_furnace') {
    if (tryInsertIntoFurnace(target, belt.item)) {
      belt.item = null
      belt.itemProgress = 0
    } else {
      belt.itemProgress = 1
    }
    return
  }

  belt.itemProgress = 1
}

export function createTransportBelt(
  tileX: number,
  tileY: number,
  direction: Direction,
): TransportBelt {
  return {
    type: 'transport_belt',
    tileX,
    tileY,
    direction,
    item: null,
    itemProgress: 0,
  }
}

export function drawFallbackBeltSprite(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  belt: TransportBelt,
  alpha = 1,
) {
  ctx.save()
  ctx.globalAlpha = alpha

  ctx.fillStyle = '#424242'
  ctx.fillRect(screenX + 3, screenY + 3, TILE_SIZE - 6, TILE_SIZE - 6)

  ctx.fillStyle = '#616161'
  if (belt.direction === 'up' || belt.direction === 'down') {
    ctx.fillRect(screenX + 11, screenY + 4, 10, TILE_SIZE - 8)
  } else {
    ctx.fillRect(screenX + 4, screenY + 11, TILE_SIZE - 8, 10)
  }

  drawDirectionMarker(ctx, screenX, screenY, belt.direction, TILE_SIZE, '#90caf9')

  ctx.restore()
}

export function getBeltItemOffset(direction: Direction, progress: number) {
  if (direction === 'up') return { x: 16, y: 24 - progress * 16 }
  if (direction === 'right') return { x: 8 + progress * 16, y: 16 }
  if (direction === 'down') return { x: 16, y: 8 + progress * 16 }
  return { x: 24 - progress * 16, y: 16 }
}

export function drawBeltItem(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  belt: TransportBelt,
) {
  if (!belt.item) return

  const offset = getBeltItemOffset(belt.direction, belt.itemProgress)
  ctx.fillStyle = getItemDrawColor(belt.item)
  ctx.fillRect(screenX + offset.x - 4, screenY + offset.y - 4, 8, 8)
}

export function drawBeltSprite(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  belt: TransportBelt,
  alpha = 1,
) {
  drawFallbackBeltSprite(ctx, screenX, screenY, belt, alpha)
  if (alpha >= 1) {
    drawBeltItem(ctx, screenX, screenY, belt)
  }
}