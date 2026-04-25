import { worldToScreen } from '../camera'
import { TILE_SIZE } from '../world'
import type { BuildSelection, Direction } from './types'
import { drawFallbackBeltSprite } from './belts'
import { drawFallbackChestSprite } from './chest'
import { drawFallbackBurnerDrillSprite } from './drill'
import { drawFallbackFurnaceSprite } from './furnace'
import { drawFallbackInserterSprite } from './inserter'

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
