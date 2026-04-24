import type { BurnerInserter, Direction, ItemType } from './types'
import { TILE_SIZE } from '../world'
import { canBurnerConsumeItem, getFuelValue, getItemDrawColor } from './items'
import {
  canBuildingAcceptItem,
  getBackTile,
  getBuildingAtTile,
  getFrontTile,
  takeOneItemFromBuildingInternal,
  tryInsertIntoBuilding,
} from './tile'

export function canInsertIntoInserter(inserter: BurnerInserter, item: ItemType) {
  return inserter.heldItem === null && canBurnerConsumeItem(item)
}

export function tryInsertIntoInserter(inserter: BurnerInserter, item: ItemType) {
  if (!canInsertIntoInserter(inserter, item)) return false
  inserter.fuel += getFuelValue(item)
  return true
}

export function getInserterPickupTile(inserter: BurnerInserter) {
  return getBackTile(inserter.tileX, inserter.tileY, inserter.direction)
}

export function getInserterDropTile(inserter: BurnerInserter) {
  return getFrontTile(inserter.tileX, inserter.tileY, inserter.direction)
}

export function updateInserter(inserter: BurnerInserter, dt: number) {
  if (inserter.heldItem === null) {
    if (inserter.fuel <= 0) {
      inserter.progress = 0
      return
    }

    const pickupTile = getInserterPickupTile(inserter)
    const source = getBuildingAtTile(pickupTile.x, pickupTile.y)
    if (!source) {
      inserter.progress = 0
      return
    }

    const item = takeOneItemFromBuildingInternal(source)
    if (!item) {
      inserter.progress = 0
      return
    }

    inserter.heldItem = item
    inserter.fuel = Math.max(0, inserter.fuel - Math.min(dt, inserter.fuel))
    inserter.progress += dt * 3
    if (inserter.progress >= 1) inserter.progress = 1
    return
  }

  const dropTile = getInserterDropTile(inserter)
  const target = getBuildingAtTile(dropTile.x, dropTile.y)
  if (!target || !canBuildingAcceptItem(target, inserter.heldItem)) {
    inserter.progress = 1
    return
  }

  if (inserter.fuel <= 0) return

  inserter.fuel = Math.max(0, inserter.fuel - dt)
  inserter.progress += dt * 3

  if (inserter.progress < 1) return

  if (tryInsertIntoBuilding(target, inserter.heldItem)) {
    inserter.heldItem = null
    inserter.progress = 0
  } else {
    inserter.progress = 1
  }
}

export function createBurnerInserter(
  tileX: number,
  tileY: number,
  direction: Direction,
): BurnerInserter {
  return {
    type: 'burner_inserter',
    tileX,
    tileY,
    direction,
    fuel: 0,
    progress: 0,
    heldItem: null,
  }
}

export const placeFurnerInserter = createBurnerInserter

export function drawFallbackInserterSprite(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  inserter: BurnerInserter,
  alpha = 1,
) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(screenX + TILE_SIZE / 2, screenY + TILE_SIZE / 2)

  let angle = 0
  if (inserter.direction === 'up') angle = -Math.PI / 2
  if (inserter.direction === 'right') angle = 0
  if (inserter.direction === 'down') angle = Math.PI / 2
  if (inserter.direction === 'left') angle = Math.PI

  const swing = inserter.heldItem ? inserter.progress : 1 - inserter.progress
  const swingOffset = (swing - 0.5) * 1.2

  ctx.rotate(angle + swingOffset)

  ctx.fillStyle = '#5d4037'
  ctx.fillRect(-5, 8, 10, 10)

  ctx.fillStyle = '#ffca28'
  ctx.fillRect(-2, -12, 4, 22)

  ctx.fillStyle = '#90a4ae'
  ctx.fillRect(-4, -18, 8, 8)

  if (inserter.heldItem) {
    ctx.fillStyle = getItemDrawColor(inserter.heldItem)
    ctx.fillRect(-4, -24, 8, 8)
  }

  ctx.restore()
}

export const drawFalblackInserterSprite = drawFallbackInserterSprite

export function drawInserterSprite(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  inserter: BurnerInserter,
  alpha = 1,
) {
  drawFallbackInserterSprite(ctx, screenX, screenY, inserter, alpha)
}

export const crawInserterSprite = drawInserterSprite