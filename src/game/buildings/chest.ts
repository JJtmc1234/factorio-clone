import type { ItemType, WoodenChest } from './types'
import { TILE_SIZE } from '../world'

export function tryInsertIntoChest(chest: WoodenChest, item: ItemType, count: number) {
  if (chest.count >= chest.capacity) return 0
  if (chest.item !== null && chest.item !== item) return 0

  if (chest.item === null) {
    chest.item = item
  }

  const moved = Math.min(chest.capacity - chest.count, count)
  chest.count += moved
  return moved
}

export function consumeCoalFromChest(chest: WoodenChest) {
  if (chest.item !== 'coal' || chest.count <= 0) return false

  chest.count -= 1
  if (chest.count <= 0) {
    chest.count = 0
    chest.item = null
  }

  return true
}

export function takeOneFromChestInternal(chest: WoodenChest) {
  if (!chest.item || chest.count <= 0) return null
  const item = chest.item
  chest.count -= 1
  if (chest.count <= 0) {
    chest.count = 0
    chest.item = null
  }
  return item
}

export function createWoodenChest(tileX: number, tileY: number): WoodenChest {
  return {
    type: 'wooden_chest',
    tileX,
    tileY,
    item: null,
    count: 0,
    capacity: 50,
  }
}

export function drawFallbackChestSprite(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  chest: WoodenChest,
  alpha = 1,
) {
  ctx.save()
  ctx.globalAlpha = alpha

  ctx.fillStyle = '#5d4037'
  ctx.fillRect(screenX + 2, screenY + 4, TILE_SIZE - 4, TILE_SIZE - 8)

  ctx.fillStyle = '#8d6e63'
  ctx.fillRect(screenX + 4, screenY + 6, TILE_SIZE - 8, TILE_SIZE - 12)

  ctx.fillStyle = '#3e2723'
  ctx.fillRect(screenX + 13, screenY + 12, 6, 8)

  if (chest.count > 0) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
    ctx.fillRect(screenX + 2, screenY + 2, 18, 12)
    ctx.fillStyle = 'white'
    ctx.font = '10px sans-serif'
    ctx.fillText(String(chest.count), screenX + 5, screenY + 11)
  }

  ctx.restore()
}

export function drawChestSprite(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  chest: WoodenChest,
  alpha = 1,
) {
  drawFallbackChestSprite(ctx, screenX, screenY, chest, alpha)
}