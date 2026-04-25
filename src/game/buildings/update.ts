import { getTileAtWorldTile } from '../world'
import { isMineableResource } from './items'
import { getAllBuildings } from './store'
import { updateBelt } from './belts'
import {
  tryAutoFuelDrill,
  tryPushDrillOutput,
  getDrillMiningTile,
  canAcceptDrillOutput,
  addDrillOutput,
} from './drill'
import { updateFurnace } from './furnace'
import { updateInserter } from './inserter'

export function updateBuildings(dt: number) {
  const buildings = getAllBuildings()

  for (const building of buildings) {
    if (building.type !== 'burner_drill') continue

    tryAutoFuelDrill(building)
    tryPushDrillOutput(building)

    const miningTile = getDrillMiningTile(building)
    if (building.fuel <= 0) continue
    if (!miningTile) continue

    const tile = getTileAtWorldTile(miningTile.x, miningTile.y)
    const resourceType = tile.object?.type

    if (!isMineableResource(resourceType)) continue
    if (!canAcceptDrillOutput(building, resourceType)) continue

    building.fuel = Math.max(0, building.fuel - dt)
    building.progress += dt * 0.35

    while (building.progress >= 1) {
      const currentMiningTile = getDrillMiningTile(building)
      if (!currentMiningTile) {
        building.progress = 0
        break
      }

      const currentTile = getTileAtWorldTile(currentMiningTile.x, currentMiningTile.y)
      const currentType = currentTile.object?.type

      if (!isMineableResource(currentType)) {
        building.progress = 0
        break
      }

      if (!addDrillOutput(building, currentType)) {
        building.progress = 0.999
        break
      }

      const obj = currentTile.object!
      obj.amount -= 1
      building.progress -= 1

      if (obj.amount <= 0) {
        currentTile.object = null
      }
    }

    tryPushDrillOutput(building)
  }

  for (const building of buildings) {
    if (building.type === 'transport_belt') {
      updateBelt(building, dt)
    }
  }

  for (const building of buildings) {
    if (building.type === 'stone_furnace') {
      updateFurnace(building, dt)
    }
  }

  for (const building of buildings) {
    if (building.type === 'burner_inserter') {
      updateInserter(building, dt)
    }
  }
}
