import { worldToScreen } from '../camera'
import { TILE_SIZE, isTileExplored, isTileVisible } from '../world'
import type { BuildSelection, Building, BurnerInserter, Direction } from './types'
import { getAllBuildings } from './state'
import {
  drawBeltSprite,
  drawFallbackBeltSprite,
} from './belts'
import {
  drawChestSprite,
  drawFallbackChestSprite,
} from './chest'
import {
  drawBurnerDrillSprite,
  drawFallbackBurnerDrillSprite,
  getDrillCoveredTiles,
} from './drill'
import {
  drawFurnaceSprite,
  drawFallbackFurnaceSprite,
  getFurnaceCoveredTiles,
} from './furnace'
import {
  drawFallbackInserterSprite,
  drawInserterSprite,
} from './inserter'

export function drawDirectionMarker(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  direction: Direction,
  size: number,
  color = '#ffd54f',
) {
  ctx.fillStyle = color

  if (direction === 'up') ctx.fillRect(screenX + size / 2 - 8, screenY + 4, 16, 6)
  else if (direction === 'right') ctx.fillRect(screenX + size - 10, screenY + size / 2 - 8, 6, 16)
  else if (direction === 'down') ctx.fillRect(screenX + size / 2 - 8, screenY + size - 10, 16, 6)
  else ctx.fillRect(screenX + 4, screenY + size / 2 - 8, 6, 16)
}

export function drawSpriteRotated(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: number,
  alpha = 1,
) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(x + width / 2, y + height / 2)
  ctx.rotate(rotation)
  ctx.drawImage(image, -width / 2, -height / 2, width, height)
  ctx.restore()
}

export function renderBuildings(ctx: CanvasRenderingContext2D) {
  for (const building of getAllBuildings()) {
    if (building.type === 'burner_drill') {
      const anyTileExplored = getDrillCoveredTiles(building).some((tile) =>
        isTileExplored(tile.x, tile.y),
      )
      if (!anyTileExplored) continue

      const screen = worldToScreen(building.tileX * TILE_SIZE, building.tileY * TILE_SIZE)
      drawBurnerDrillSprite(ctx, screen.x, screen.y, building)

      const allTilesVisible = getDrillCoveredTiles(building).every((tile) =>
        isTileVisible(tile.x, tile.y),
      )
      if (!allTilesVisible) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
        ctx.fillRect(screen.x, screen.y, TILE_SIZE * 2, TILE_SIZE * 2)
      }

      continue
    }

    if (building.type === 'stone_furnace') {
      const anyTileExplored = getFurnaceCoveredTiles(building).some((tile) =>
        isTileExplored(tile.x, tile.y),
      )
      if (!anyTileExplored) continue

      const screen = worldToScreen(building.tileX * TILE_SIZE, building.tileY * TILE_SIZE)
      drawFurnaceSprite(ctx, screen.x, screen.y, building)

      const allTilesVisible = getFurnaceCoveredTiles(building).every((tile) =>
        isTileVisible(tile.x, tile.y),
      )
      if (!allTilesVisible) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
        ctx.fillRect(screen.x, screen.y, TILE_SIZE * 2, TILE_SIZE * 2)
      }

      continue
    }

    if (!isTileExplored(building.tileX, building.tileY)) continue

    const screen = worldToScreen(building.tileX * TILE_SIZE, building.tileY * TILE_SIZE)

    if (building.type === 'wooden_chest') {
      drawChestSprite(ctx, screen.x, screen.y, building)
    } else if (building.type === 'transport_belt') {
      drawBeltSprite(ctx, screen.x, screen.y, building)
    } else {
      drawInserterSprite(ctx, screen.x, screen.y, building as BurnerInserter)
    }

    if (!isTileVisible(building.tileX, building.tileY)) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
      ctx.fillRect(screen.x, screen.y, TILE_SIZE, TILE_SIZE)
    }
  }
}

export function renderBuildingGhost(
  ctx: CanvasRenderingContext2D,
  buildingType: Exclude<BuildSelection, null>,
  tileX: number,
  tileY: number,
  direction: Direction,
  valid: boolean,
) {
  const screen = worldToScreen(tileX * TILE_SIZE, tileY * TILE_SIZE)
  const alpha = valid ? 0.5 : 0.25

  if (buildingType === 'burner_drill') {
    drawFallbackBurnerDrillSprite(
      ctx,
      screen.x,
      screen.y,
      {
        type: 'burner_drill',
        tileX,
        tileY,
        direction,
        fuel: 0,
        progress: 0,
        outputItem: null,
        outputCount: 0,
        outputCapacity: 8,
      },
      alpha,
    )
    return
  }

  if (buildingType === 'stone_furnace') {
    drawFallbackFurnaceSprite(
      ctx,
      screen.x,
      screen.y,
      {
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
      },
      alpha,
    )
    return
  }

  if (buildingType === 'wooden_chest') {
    drawFallbackChestSprite(
      ctx,
      screen.x,
      screen.y,
      {
        type: 'wooden_chest',
        tileX,
        tileY,
        item: null,
        count: 0,
        capacity: 50,
      },
      alpha,
    )
    return
  }

  if (buildingType === 'transport_belt') {
    drawFallbackBeltSprite(
      ctx,
      screen.x,
      screen.y,
      {
        type: 'transport_belt',
        tileX,
        tileY,
        direction,
        item: null,
        itemProgress: 0,
      },
      alpha,
    )
    return
  }

  drawFallbackInserterSprite(
    ctx,
    screen.x,
    screen.y,
    {
      type: 'burner_inserter',
      tileX,
      tileY,
      direction,
      fuel: 0,
      progress: 0,
      heldItem: null,
    },
    alpha,
  )
}

export function getBuildingTooltipLines(building: Building) {
  if (building.type === 'wooden_chest') {
    const itemText = building.item ?? 'empty'
    return [
      'wooden chest',
      `${itemText}: ${building.count}/${building.capacity}`,
      'E open  X deconstruct',
    ]
  }

  if (building.type === 'transport_belt') {
    return [
      `belt ${building.direction}`,
      `item: ${building.item ?? 'empty'}`,
      'E open  G take  X deconstruct',
    ]
  }

  if (building.type === 'stone_furnace') {
    return [
      `2x2 furnace fuel:${building.fuel.toFixed(1)}`,
      `in: ${(building.inputItem ?? 'empty')} ${building.inputCount}/${building.inputCapacity}`,
      `out: ${(building.outputItem ?? 'empty')} ${building.outputCount}/${building.outputCapacity}`,
    ]
  }

  if (building.type === 'burner_inserter') {
    return [
      `burner inserter ${building.direction} fuel:${building.fuel.toFixed(1)}`,
      `held: ${building.heldItem ?? 'empty'}  progress:${building.progress.toFixed(2)}`,
      'F fuel  G take held item  X deconstruct',
    ]
  }

  const outputText = building.outputItem
    ? `${building.outputItem} ${building.outputCount}/${building.outputCapacity}`
    : `empty 0/${building.outputCapacity}`

  return [
    `2x2 drill ${building.direction} fuel:${building.fuel.toFixed(1)}`,
    `out: ${outputText}`,
    'F fuel  E open  X deconstruct',
  ]
}