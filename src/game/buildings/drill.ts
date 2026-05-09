import type { BurnerDrill, Direction, ItemType } from './types'
import { TILE_SIZE, getTileAtWorldTile } from '../world'
import { getGameSprite } from '../../components/gameSprites'
import { isMineableResource, getItemDrawColor } from './items'
import { getBuildingAtTile } from './tile'
import { tryInsertIntoChest, consumeCoalFromChest } from './chest'
import { tryInsertIntoBelt } from './belts'
import { tryInsertIntoFurnace } from './furnace'
import { drawDirectionMarker, drawSpriteRotated } from './draw-helpers'

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

  if (
    (target.type === 'wooden_chest' || target.type === 'iron_chest') &&
    consumeCoalFromChest(target)
  ) {
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

  if (target.type === 'wooden_chest' || target.type === 'iron_chest') {
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

// Kept for backwards-compat — used when the directional sheets (burner_drill_n
// /e/s/w from the Factorio install) aren't available and we fall back to the
// single-frame wiki sprite. With the directional sheets each sprite already
// faces the right way, so no rotation is applied in that path.
export function getDrillRotation(direction: Direction) {
  if (direction === 'down') return 0
  if (direction === 'left') return Math.PI / 2
  if (direction === 'up') return Math.PI
  return -Math.PI / 2 // 'right'
}

// Drill animation matches the lua: 32 frames in a 4-col × 8-row grid,
// run_mode = forward-then-backward at animation_speed 0.5 frames/tick
// (= 30 frames/sec at the default 60 ticks/sec).
const DRILL_FRAME_W = 173
const DRILL_FRAME_H = 188
const DRILL_COLS = 4
const DRILL_FRAMES = 32
const DRILL_FPS = 30

function getDrillSheetKey(direction: Direction) {
  if (direction === 'up') return 'burner_drill_n'
  if (direction === 'right') return 'burner_drill_e'
  if (direction === 'down') return 'burner_drill_s'
  return 'burner_drill_w'
}

export function drawBurnerDrillSprite(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  drill: BurnerDrill,
  alpha = 1,
) {
  const size = TILE_SIZE * 2

  // Preferred path: 4 directional sprite sheets from the Factorio install.
  const sheet = getGameSprite(getDrillSheetKey(drill.direction))
  if (sheet && sheet.complete && sheet.naturalWidth > 0) {
    const isWorking = drill.fuel > 0 && drill.progress > 0
    let frameIdx = 0
    if (isWorking) {
      // Forward-then-backward ping-pong: 0..31..0 in (FRAMES-1)*2 steps.
      const period = (DRILL_FRAMES - 1) * 2
      const t = Math.floor((performance.now() / 1000) * DRILL_FPS) % period
      frameIdx = t < DRILL_FRAMES ? t : period - t
    }
    const col = frameIdx % DRILL_COLS
    const row = Math.floor(frameIdx / DRILL_COLS)

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.drawImage(
      sheet,
      col * DRILL_FRAME_W,
      row * DRILL_FRAME_H,
      DRILL_FRAME_W,
      DRILL_FRAME_H,
      screenX,
      screenY,
      size,
      size,
    )

    // Fuel bar overlay (kept on top so the player can see fuel level).
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

  // Fallback: single-frame wiki sprite with rotation, then canvas fallback.
  const sprite = getGameSprite('burner_drill')

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

    // Direction arrow on the output side so it's unambiguous which way the
    // drill is facing without having to interpret the sprite's geometry.
    drawDirectionMarker(ctx, screenX, screenY, drill.direction, size, '#ffd54f')

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