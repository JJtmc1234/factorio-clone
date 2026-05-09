import type { AnyChest, IronChest, ItemType, WoodenChest } from './types'
import { TILE_SIZE } from '../world'
import { getGameSprite, isSpriteReady } from '../../components/gameSprites'
import { isAltMode } from '../altMode'

export function tryInsertIntoChest(chest: AnyChest, item: ItemType, count: number) {
  if (chest.count >= chest.capacity) return 0
  if (chest.item !== null && chest.item !== item) return 0

  if (chest.item === null) {
    chest.item = item
  }

  const moved = Math.min(chest.capacity - chest.count, count)
  chest.count += moved
  return moved
}

export function consumeCoalFromChest(chest: AnyChest) {
  if (chest.item !== 'coal' || chest.count <= 0) return false

  chest.count -= 1
  if (chest.count <= 0) {
    chest.count = 0
    chest.item = null
  }

  return true
}

export function takeOneFromChestInternal(chest: AnyChest) {
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

export function createIronChest(tileX: number, tileY: number): IronChest {
  return {
    type: 'iron_chest',
    tileX,
    tileY,
    item: null,
    count: 0,
    capacity: 100,
  }
}

function drawChestCountBadge(
  ctx: CanvasRenderingContext2D,
  chest: AnyChest,
  screenX: number,
  screenY: number,
) {
  if (chest.count <= 0) return
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
  ctx.fillRect(screenX + 2, screenY + 2, 18, 12)
  ctx.fillStyle = 'white'
  ctx.font = '10px sans-serif'
  ctx.fillText(String(chest.count), screenX + 5, screenY + 11)
}

function drawChestAltOverlay(
  ctx: CanvasRenderingContext2D,
  chest: AnyChest,
  screenX: number,
  screenY: number,
) {
  if (!isAltMode() || !chest.item) return
  const sprite = getGameSprite(chest.item)
  if (!isSpriteReady(sprite)) return
  const size = 18
  ctx.drawImage(
    sprite,
    screenX + (TILE_SIZE - size) / 2,
    screenY + (TILE_SIZE - size) / 2,
    size,
    size,
  )
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

  drawChestAltOverlay(ctx, chest, screenX, screenY)
  drawChestCountBadge(ctx, chest, screenX, screenY)
  ctx.restore()
}

export function drawChestSprite(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  chest: WoodenChest,
  alpha = 1,
) {
  const sprite = getGameSprite('wooden_chest')
  if (isSpriteReady(sprite)) {
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.drawImage(sprite, screenX, screenY, TILE_SIZE, TILE_SIZE)
    drawChestAltOverlay(ctx, chest, screenX, screenY)
    drawChestCountBadge(ctx, chest, screenX, screenY)
    ctx.restore()
    return
  }
  drawFallbackChestSprite(ctx, screenX, screenY, chest, alpha)
}

export function drawFallbackIronChestSprite(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  chest: IronChest,
  alpha = 1,
) {
  ctx.save()
  ctx.globalAlpha = alpha

  ctx.fillStyle = '#37474f'
  ctx.fillRect(screenX + 2, screenY + 4, TILE_SIZE - 4, TILE_SIZE - 8)

  ctx.fillStyle = '#607d8b'
  ctx.fillRect(screenX + 4, screenY + 6, TILE_SIZE - 8, TILE_SIZE - 12)

  ctx.fillStyle = '#263238'
  ctx.fillRect(screenX + 13, screenY + 12, 6, 8)

  // Rivets — distinguishes iron from wooden visually.
  ctx.fillStyle = '#cfd8dc'
  ctx.fillRect(screenX + 5, screenY + 7, 2, 2)
  ctx.fillRect(screenX + TILE_SIZE - 7, screenY + 7, 2, 2)
  ctx.fillRect(screenX + 5, screenY + TILE_SIZE - 9, 2, 2)
  ctx.fillRect(screenX + TILE_SIZE - 7, screenY + TILE_SIZE - 9, 2, 2)

  drawChestAltOverlay(ctx, chest, screenX, screenY)
  drawChestCountBadge(ctx, chest, screenX, screenY)
  ctx.restore()
}

export function drawIronChestSprite(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  chest: IronChest,
  alpha = 1,
) {
  const sprite = getGameSprite('iron_chest')
  if (isSpriteReady(sprite)) {
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.drawImage(sprite, screenX, screenY, TILE_SIZE, TILE_SIZE)
    drawChestAltOverlay(ctx, chest, screenX, screenY)
    drawChestCountBadge(ctx, chest, screenX, screenY)
    ctx.restore()
    return
  }
  drawFallbackIronChestSprite(ctx, screenX, screenY, chest, alpha)
}