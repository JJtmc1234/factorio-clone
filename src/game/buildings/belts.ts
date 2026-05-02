import type { Direction, ItemType, TransportBelt } from './types'
import { TILE_SIZE } from '../world'
import { getItemDrawColor } from './items'
import { getBackTile, getFrontTile, getBuildingAtTile } from './tile'
import { tryInsertIntoChest } from './chest'
import { tryInsertIntoFurnace } from './furnace'
import { drawDirectionMarker } from './draw-helpers'
import { getGameSprite, isSpriteReady } from '../../components/gameSprites'

// Yellow belt = 15 items/second past a fixed point at full saturation.
// With BELT_ITEM_SPACING = 1/8 (8 items per tile-length), the speed in
// progress-per-second is 15 * 1/8 = 1.875.
export const BELT_CAPACITY = 8
export const BELT_ITEM_SPACING = 1 / BELT_CAPACITY
export const BELT_SPEED = 1.875

// Insertion happens at the back of the belt (progress = 0). Reject if any
// existing item is too close to the entry point.
export function tryInsertIntoBelt(belt: TransportBelt, item: ItemType) {
  if (belt.items.length >= BELT_CAPACITY) return false
  // Items are stored with descending progress. The entry side is the most
  // recent (smallest) progress.
  const last = belt.items[belt.items.length - 1]
  if (last && last.progress < BELT_ITEM_SPACING) return false
  belt.items.push({ item, progress: 0 })
  return true
}

// Predicate version (used by inserters / hand-feed). Doesn't mutate.
export function canBeltAcceptAtRear(belt: TransportBelt) {
  if (belt.items.length >= BELT_CAPACITY) return false
  const last = belt.items[belt.items.length - 1]
  return !last || last.progress >= BELT_ITEM_SPACING
}

export function takeFrontBeltItem(belt: TransportBelt): ItemType | null {
  if (belt.items.length === 0) return null
  // Inserters/players grab the most-advanced item.
  const head = belt.items[0]
  if (head.progress < 0.5) return null // not yet far enough to grab
  belt.items.shift()
  return head.item
}

function ejectFrontItem(belt: TransportBelt): boolean {
  if (belt.items.length === 0) return false
  const head = belt.items[0]
  if (head.progress < 1) return false

  const nextTile = getFrontTile(belt.tileX, belt.tileY, belt.direction)
  const target = getBuildingAtTile(nextTile.x, nextTile.y)
  if (!target) return false

  if (target.type === 'transport_belt') {
    if (tryInsertIntoBelt(target, head.item)) {
      belt.items.shift()
      return true
    }
    return false
  }

  if (target.type === 'wooden_chest' || target.type === 'iron_chest') {
    const moved = tryInsertIntoChest(target, head.item, 1)
    if (moved > 0) {
      belt.items.shift()
      return true
    }
    return false
  }

  if (target.type === 'stone_furnace') {
    if (tryInsertIntoFurnace(target, head.item)) {
      belt.items.shift()
      return true
    }
    return false
  }

  return false
}

export function updateBelt(belt: TransportBelt, dt: number) {
  if (belt.items.length === 0) return

  // Try to push the front item off the belt first; this opens space for
  // items behind it to advance this tick.
  ejectFrontItem(belt)
  if (belt.items.length === 0) return

  // Advance items front-to-back, clamping each to the slot behind the one
  // ahead of it. Items must keep at least BELT_ITEM_SPACING between them.
  const step = dt * BELT_SPEED
  for (let i = 0; i < belt.items.length; i++) {
    const current = belt.items[i]
    let next = current.progress + step
    if (i === 0) {
      if (next > 1) next = 1
    } else {
      const ahead = belt.items[i - 1]
      const cap = ahead.progress - BELT_ITEM_SPACING
      if (next > cap) next = cap
    }
    if (next < current.progress) next = current.progress
    current.progress = next
  }
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
    items: [],
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

// Detect whether this belt is a curve. A curve = exactly one perpendicular
// belt feeds into the back tile. Returns the curve direction so item paths
// can arc through the corner.
export function getBeltCurve(belt: TransportBelt): 'left' | 'right' | null {
  const back = getBackTile(belt.tileX, belt.tileY, belt.direction)
  const backBuilding = getBuildingAtTile(back.x, back.y)
  if (!backBuilding || backBuilding.type !== 'transport_belt') return null
  if (backBuilding.direction === belt.direction) return null

  // Perpendicular feeder: figure out left vs right turn relative to our heading.
  const inDir = backBuilding.direction
  const out = belt.direction
  const turnsRight =
    (out === 'right' && inDir === 'up') ||
    (out === 'down' && inDir === 'right') ||
    (out === 'left' && inDir === 'down') ||
    (out === 'up' && inDir === 'left')
  return turnsRight ? 'right' : 'left'
}

// Item position along a curved arc (when belt is a corner) vs. straight line.
function getBeltItemPos(
  belt: TransportBelt,
  progress: number,
): { x: number; y: number } {
  const curve = getBeltCurve(belt)
  if (!curve) {
    return getStraightItemPos(belt.direction, progress)
  }

  // Corner: arc from the entry side (back, perpendicular axis) sweeping into
  // the exit direction. The pivot is the corner of the tile opposite the
  // straight-through point.
  const back = getBackTile(belt.tileX, belt.tileY, belt.direction)
  // Vector from this belt's tile center to where items enter (back side)
  const enterDir = oppositeDirection(belt.direction)
  // Use the feeder's direction as the entry direction (item moves from
  // feeder toward us when entering — same as `back -> belt`).
  const inDir = (() => {
    const b = getBuildingAtTile(back.x, back.y)
    return b && b.type === 'transport_belt' ? b.direction : enterDir
  })()
  const start = unitVec(oppositeDirection(inDir))
  const end = unitVec(belt.direction)
  // Quarter-circle arc through tile center.
  // progress=0 at the back-entry midpoint; progress=1 at the front-exit midpoint.
  const t = progress
  // Spherical-ish lerp on a quarter arc — quick and cheap.
  const angle = Math.atan2(start.y, start.x) * (1 - t) + Math.atan2(end.y, end.x) * t
  const r = 0.5 * TILE_SIZE
  return {
    x: TILE_SIZE / 2 + Math.cos(angle) * r,
    y: TILE_SIZE / 2 + Math.sin(angle) * r,
  }
}

function getStraightItemPos(direction: Direction, progress: number) {
  if (direction === 'up') return { x: 16, y: 32 - progress * 32 }
  if (direction === 'right') return { x: progress * 32, y: 16 }
  if (direction === 'down') return { x: 16, y: progress * 32 }
  return { x: 32 - progress * 32, y: 16 }
}

function oppositeDirection(d: Direction): Direction {
  if (d === 'up') return 'down'
  if (d === 'down') return 'up'
  if (d === 'left') return 'right'
  return 'left'
}

function unitVec(d: Direction) {
  if (d === 'up') return { x: 0, y: -1 }
  if (d === 'right') return { x: 1, y: 0 }
  if (d === 'down') return { x: 0, y: 1 }
  return { x: -1, y: 0 }
}

export function drawBeltItems(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  belt: TransportBelt,
) {
  for (const slot of belt.items) {
    const pos = getBeltItemPos(belt, slot.progress)
    ctx.fillStyle = getItemDrawColor(slot.item)
    ctx.fillRect(screenX + pos.x - 4, screenY + pos.y - 4, 8, 8)
  }
}

function getBeltRotation(direction: Direction) {
  if (direction === 'right') return 0
  if (direction === 'down') return Math.PI / 2
  if (direction === 'left') return Math.PI
  return -Math.PI / 2
}

export function drawBeltSprite(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  belt: TransportBelt,
  alpha = 1,
) {
  const sprite = getGameSprite('transport_belt')
  if (isSpriteReady(sprite)) {
    // Belt scrolling animation: shift the sprite source along its travel
    // axis at the same speed items move (1.875 tiles/sec). The sprite is
    // square so we pan source-x and wrap.
    const phase = ((performance.now() / 1000) * BELT_SPEED) % 1
    drawScrollingBelt(ctx, sprite, screenX, screenY, belt.direction, phase, alpha)
  } else {
    drawFallbackBeltSprite(ctx, screenX, screenY, belt, alpha)
  }

  if (alpha >= 1) {
    drawBeltItems(ctx, screenX, screenY, belt)
  }
}

function drawScrollingBelt(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLImageElement,
  screenX: number,
  screenY: number,
  direction: Direction,
  phase: number,
  alpha: number,
) {
  // Rotate the canvas so we can pan source-x in a single axis. Positive
  // pan moves the texture forward along the belt.
  const rotation = getBeltRotation(direction)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(screenX + TILE_SIZE / 2, screenY + TILE_SIZE / 2)
  ctx.rotate(rotation)

  const sw = sprite.naturalWidth
  const sh = sprite.naturalHeight
  const panSrc = phase * sw
  // Two passes so the wrap is seamless.
  ctx.drawImage(
    sprite,
    panSrc,
    0,
    sw - panSrc,
    sh,
    -TILE_SIZE / 2,
    -TILE_SIZE / 2,
    TILE_SIZE * (1 - phase),
    TILE_SIZE,
  )
  if (panSrc > 0) {
    ctx.drawImage(
      sprite,
      0,
      0,
      panSrc,
      sh,
      -TILE_SIZE / 2 + TILE_SIZE * (1 - phase),
      -TILE_SIZE / 2,
      TILE_SIZE * phase,
      TILE_SIZE,
    )
  }
  ctx.restore()
}
