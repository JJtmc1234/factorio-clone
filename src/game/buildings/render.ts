import { worldToScreen } from '../camera'
import { TILE_SIZE } from '../world'
import type { BurnerInserter } from './types'
import { getAllBuildings } from './store'
import { drawBeltSprite } from './belts'
import { drawChestSprite } from './chest'
import { drawBurnerDrillSprite } from './drill'
import { drawFurnaceSprite } from './furnace'
import { drawInserterSprite } from './inserter'

export function renderBuildings(ctx: CanvasRenderingContext2D) {
  for (const building of getAllBuildings()) {
    const screen = worldToScreen(building.tileX * TILE_SIZE, building.tileY * TILE_SIZE)

    if (building.type === 'burner_drill') {
      drawBurnerDrillSprite(ctx, screen.x, screen.y, building)
    } else if (building.type === 'stone_furnace') {
      drawFurnaceSprite(ctx, screen.x, screen.y, building)
    } else if (building.type === 'wooden_chest') {
      drawChestSprite(ctx, screen.x, screen.y, building)
    } else if (building.type === 'transport_belt') {
      drawBeltSprite(ctx, screen.x, screen.y, building)
    } else {
      drawInserterSprite(ctx, screen.x, screen.y, building as BurnerInserter)
    }
  }
}
