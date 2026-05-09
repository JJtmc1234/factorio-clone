import type { Direction, ItemType, TransportBelt } from './types'
import { TILE_SIZE } from '../world'
import { getItemDrawColor } from './items'
import { getBackTile, getFrontTile, getBuildingAtTile } from './tile'
import { tryInsertIntoChest } from './chest'
import { tryInsertIntoFurnace } from './furnace'
import { drawDirectionMarker } from './draw-helpers'
import { getGameSprite, isSpriteReady } from '../../components/gameSprites'
import { isAltMode } from '../altMode'

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

// Detect a belt curve. A curve happens when one of the perpendicular SIDE
// tiles holds a belt whose direction points INTO this belt (so its output
// flows here). Returns the side the feeder is on (= input direction). Null
// when the back-feed is straight-through or there's no perpendicular feeder.
export function getBeltCurve(belt: TransportBelt): { inputDir: Direction } | null {
  const perpDirs: Direction[] =
    belt.direction === 'up' || belt.direction === 'down'
      ? ['left', 'right']
      : ['up', 'down']

  let foundInput: Direction | null = null
  let count = 0
  for (const sideDir of perpDirs) {
    const side = stepInDirection(belt.tileX, belt.tileY, sideDir)
    const sideBuilding = getBuildingAtTile(side.x, side.y)
    if (
      sideBuilding?.type === 'transport_belt' &&
      sideBuilding.direction === oppositeDirection(sideDir)
    ) {
      count += 1
      foundInput = sideDir
    }
  }
  if (count !== 1) return null

  // If a back-belt is also feeding straight in, treat as straight (matches
  // Factorio's belt rendering — straight wins when both inputs exist).
  const back = getBackTile(belt.tileX, belt.tileY, belt.direction)
  const backBuilding = getBuildingAtTile(back.x, back.y)
  if (backBuilding?.type === 'transport_belt' && backBuilding.direction === belt.direction) {
    return null
  }

  return { inputDir: foundInput! }
}

function stepInDirection(x: number, y: number, dir: Direction) {
  if (dir === 'up') return { x, y: y - 1 }
  if (dir === 'down') return { x, y: y + 1 }
  if (dir === 'left') return { x: x - 1, y }
  return { x: x + 1, y }
}

// Item position along a curved arc (when belt is a corner) vs. straight line.
function getBeltItemPos(
  belt: TransportBelt,
  progress: number,
): { x: number; y: number } {
  const curve = getBeltCurve(belt)
  if (!curve) return getStraightItemPos(belt.direction, progress)

  // Sweep from the input side midpoint to the output side midpoint along
  // an arc through the tile center. Pick the shorter path so 90° curves
  // don't fly the long way around.
  const start = unitVec(curve.inputDir)
  const end = unitVec(belt.direction)
  let a0 = Math.atan2(start.y, start.x)
  let a1 = Math.atan2(end.y, end.x)
  if (a1 - a0 > Math.PI) a1 -= 2 * Math.PI
  else if (a0 - a1 > Math.PI) a0 -= 2 * Math.PI
  const angle = a0 * (1 - progress) + a1 * progress
  const r = TILE_SIZE / 2
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
  // Alt-mode renders the actual sprite at a much larger size so contents
  // are readable from a zoomed-out view; default mode is a tiny color dot.
  const alt = isAltMode()
  for (const slot of belt.items) {
    const pos = getBeltItemPos(belt, slot.progress)
    if (alt) {
      const sprite = getGameSprite(slot.item)
      const size = 14
      if (isSpriteReady(sprite)) {
        ctx.drawImage(
          sprite,
          screenX + pos.x - size / 2,
          screenY + pos.y - size / 2,
          size,
          size,
        )
        continue
      }
    }
    ctx.fillStyle = getItemDrawColor(slot.item)
    ctx.fillRect(screenX + pos.x - 4, screenY + pos.y - 4, 8, 8)
  }
}

// Belt sprite sheet (transport_belt_sheet.png from the Factorio install) is
// 16 columns × 20 rows of 128px frames. Rows index by direction-or-curve
// per the `basic_belt_animation_set` lua comment in transport-belts.lua:
//   0=east 1=west 2=north 3=south
//   4=east_to_north 5=north_to_east
//   6=west_to_north 7=north_to_west
//   8=south_to_east 9=east_to_south
//   10=south_to_west 11=west_to_south
//   12-19 = belt-reader connection sprites (unused here)
const BELT_SHEET_FRAME = 128
const BELT_SHEET_COLS = 16
const BELT_FRAME_FPS = 30 // ≈ one full cycle per tile of belt motion

function getBeltSpriteRow(belt: TransportBelt): number {
  const curve = getBeltCurve(belt)
  if (!curve) {
    if (belt.direction === 'right') return 0
    if (belt.direction === 'left') return 1
    if (belt.direction === 'up') return 2
    return 3 // down
  }
  const inp = curve.inputDir
  const out = belt.direction
  if (inp === 'right' && out === 'up') return 4
  if (inp === 'up' && out === 'right') return 5
  if (inp === 'left' && out === 'up') return 6
  if (inp === 'up' && out === 'left') return 7
  if (inp === 'down' && out === 'right') return 8
  if (inp === 'right' && out === 'down') return 9
  if (inp === 'down' && out === 'left') return 10
  if (inp === 'left' && out === 'down') return 11
  return 0
}

export function drawBeltSprite(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  belt: TransportBelt,
  alpha = 1,
) {
  const sheet = getGameSprite('transport_belt_sheet')
  if (isSpriteReady(sheet)) {
    drawBeltSheetFrame(ctx, sheet, screenX, screenY, belt, alpha)
  } else {
    // Fallback: draw the wiki single-frame sprite without animation.
    const single = getGameSprite('transport_belt')
    if (isSpriteReady(single)) {
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.drawImage(single, screenX, screenY, TILE_SIZE, TILE_SIZE)
      ctx.restore()
    } else {
      drawFallbackBeltSprite(ctx, screenX, screenY, belt, alpha)
    }
  }

  if (alpha >= 1) {
    drawBeltItems(ctx, screenX, screenY, belt)
  }
}

function drawBeltSheetFrame(
  ctx: CanvasRenderingContext2D,
  sheet: HTMLImageElement,
  screenX: number,
  screenY: number,
  belt: TransportBelt,
  alpha: number,
) {
  const row = getBeltSpriteRow(belt)
  const frame =
    Math.floor((performance.now() / 1000) * BELT_FRAME_FPS) % BELT_SHEET_COLS
  // Source frames are 128px and render in-game at scale=0.5 → 64px = 2 tiles.
  // We draw at 2× tile size centered so the artwork overlaps the half-tile
  // margin on each side, hiding seams between adjacent belts (the same trick
  // Factorio uses).
  const drawSize = TILE_SIZE * 2
  const offset = (TILE_SIZE - drawSize) / 2
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.drawImage(
    sheet,
    frame * BELT_SHEET_FRAME,
    row * BELT_SHEET_FRAME,
    BELT_SHEET_FRAME,
    BELT_SHEET_FRAME,
    screenX + offset,
    screenY + offset,
    drawSize,
    drawSize,
  )
  ctx.restore()
}
