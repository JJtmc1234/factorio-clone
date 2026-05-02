import { worldToScreen } from '../camera'
import { TILE_SIZE } from '../world'
import type { BuildSelection, Direction } from './types'
import { drawBeltSprite } from './belts'
import { drawChestSprite, drawIronChestSprite } from './chest'
import { drawBurnerDrillSprite } from './drill'
import { drawFurnaceSprite } from './furnace'
import { drawInserterSprite } from './inserter'

// Ghosts route through the real sprite renderers (not fallbacks) so the
// player sees rotation/sprite previews that exactly match what will be
// placed. Each renderer accepts an alpha to dim the ghost.
export function renderBuildingGhost(
  ctx: CanvasRenderingContext2D,
  buildingType: Exclude<BuildSelection, null>,
  tileX: number,
  tileY: number,
  direction: Direction,
  valid: boolean,
) {
  const screen = worldToScreen(tileX * TILE_SIZE, tileY * TILE_SIZE)
  const alpha = valid ? 0.55 : 0.28

  if (buildingType === 'burner_drill') {
    drawBurnerDrillSprite(
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
    drawFurnaceSprite(
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
    drawChestSprite(
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

  if (buildingType === 'iron_chest') {
    drawIronChestSprite(
      ctx,
      screen.x,
      screen.y,
      {
        type: 'iron_chest',
        tileX,
        tileY,
        item: null,
        count: 0,
        capacity: 100,
      },
      alpha,
    )
    return
  }

  if (buildingType === 'transport_belt') {
    drawBeltSprite(
      ctx,
      screen.x,
      screen.y,
      {
        type: 'transport_belt',
        tileX,
        tileY,
        direction,
        items: [],
      },
      alpha,
    )
    return
  }

  drawInserterSprite(
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
