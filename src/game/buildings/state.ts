import { addItem, getItemCount, removeItem } from '../inventory'
import { getTileAtWorldTile } from '../world'
import type { BuildSelection, Building, Buildings, Direction } from './types'
import { isGroundBlockingObject, isMineableResource } from './items'
import { occupiesTile, getBuildingAtTile } from './tile'
import { tryInsertIntoChest, createWoodenChest, takeOneFromChestInternal } from './chest'
import { createTransportBelt, updateBelt } from './belts'
import {
  createBurnerDrill,
  tryAutoFuelDrill,
  tryPushDrillOutput,
  getDrillMiningTile,
  canAcceptDrillOutput,
  addDrillOutput,
  takeOneFromDrillOutputInternal,
} from './drill'
import {
  createStoneFurnace,
  takeOneFromFurnaceOutputInternal,
  updateFurnace,
} from './furnace'
import { createBurnerInserter, updateInserter } from './inserter'

const buildings: Buildings = []

export function getAllBuildings() {
  return buildings
}

export function canPlaceBuilding(
  type: Exclude<BuildSelection, null>,
  tileX: number,
  tileY: number,
) {
  if (type === 'wooden_chest' || type === 'transport_belt' || type === 'burner_inserter') {
    if (getBuildingAtTile(tileX, tileY)) return false
    const tile = getTileAtWorldTile(tileX, tileY)
    return !isGroundBlockingObject(tile.object?.type)
  }

  if (type === 'stone_furnace') {
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const x = tileX + dx
        const y = tileY + dy
        if (getBuildingAtTile(x, y)) return false
        const tile = getTileAtWorldTile(x, y)
        if (isGroundBlockingObject(tile.object?.type)) return false
      }
    }
    return true
  }

  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      const x = tileX + dx
      const y = tileY + dy
      if (getBuildingAtTile(x, y)) return false
      const tile = getTileAtWorldTile(x, y)
      if (tile.object && isGroundBlockingObject(tile.object.type)) return false
    }
  }

  let hasMineableResource = false
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      const tile = getTileAtWorldTile(tileX + dx, tileY + dy)
      if (tile.object && isMineableResource(tile.object.type)) {
        hasMineableResource = true
      }
    }
  }

  return hasMineableResource
}

export function addBuilding(building: Building) {
  buildings.push(building)
}

export function placeBurnerDrill(tileX: number, tileY: number, direction: Direction) {
  if (!canPlaceBuilding('burner_drill', tileX, tileY)) return false
  buildings.push(createBurnerDrill(tileX, tileY, direction))
  return true
}

export function placeWoodenChest(tileX: number, tileY: number) {
  if (!canPlaceBuilding('wooden_chest', tileX, tileY)) return false
  buildings.push(createWoodenChest(tileX, tileY))
  return true
}

export function placeTransportBelt(tileX: number, tileY: number, direction: Direction) {
  if (!canPlaceBuilding('transport_belt', tileX, tileY)) return false
  buildings.push(createTransportBelt(tileX, tileY, direction))
  return true
}

export function placeStoneFurnace(tileX: number, tileY: number) {
  if (!canPlaceBuilding('stone_furnace', tileX, tileY)) return false
  buildings.push(createStoneFurnace(tileX, tileY))
  return true
}

export function placeBurnerInserter(tileX: number, tileY: number, direction: Direction) {
  if (!canPlaceBuilding('burner_inserter', tileX, tileY)) return false
  buildings.push(createBurnerInserter(tileX, tileY, direction))
  return true
}

export function placeBuilding(
  type: Exclude<BuildSelection, null>,
  tileX: number,
  tileY: number,
  direction: Direction,
) {
  if (type === 'burner_drill') return placeBurnerDrill(tileX, tileY, direction)
  if (type === 'wooden_chest') return placeWoodenChest(tileX, tileY)
  if (type === 'transport_belt') return placeTransportBelt(tileX, tileY, direction)
  if (type === 'stone_furnace') return placeStoneFurnace(tileX, tileY)
  if (type === 'burner_inserter') return placeBurnerInserter(tileX, tileY, direction)
  return false
}

export function removeBuildingAtTile(tileX: number, tileY: number) {
  const index = buildings.findIndex((building) => occupiesTile(building, tileX, tileY))
  if (index === -1) return false

  const [building] = buildings.splice(index, 1)

  if (building.type === 'wooden_chest' && building.item && building.count > 0) {
    addItem(building.item, building.count)
  }

  if (building.type === 'transport_belt' && building.item) {
    addItem(building.item, 1)
  }

  if (building.type === 'stone_furnace') {
    if (building.inputItem && building.inputCount > 0) {
      addItem(building.inputItem, building.inputCount)
    }
    if (building.outputItem && building.outputCount > 0) {
      addItem(building.outputItem, building.outputCount)
    }
  }

  if (building.type === 'burner_drill' && building.outputItem && building.outputCount > 0) {
    addItem(building.outputItem, building.outputCount)
  }

  if (building.type === 'burner_inserter' && building.heldItem) {
    addItem(building.heldItem, 1)
  }

  return true
}

export function fuelBuildingAtTile(tileX: number, tileY: number) {
  const building = getBuildingAtTile(tileX, tileY)
  if (!building) return false

  if (getItemCount('coal') <= 0 && getItemCount('wood') <= 0) return false

  if (
    building.type === 'burner_drill' ||
    building.type === 'stone_furnace' ||
    building.type === 'burner_inserter'
  ) {
    if (removeItem('coal', 1)) {
      building.fuel += 8
      return true
    }

    if (removeItem('wood', 1)) {
      building.fuel += 5
      return true
    }
  }

  if (building.type === 'transport_belt') {
    if (building.item === null && removeItem('coal', 1)) {
      building.item = 'coal'
      building.itemProgress = 0.5
      return true
    }
  }

  return false
}

export function storeOneCoalInBuilding(building: Building) {
  if (getItemCount('coal') <= 0) return false

  if (building.type === 'wooden_chest') {
    if (!removeItem('coal', 1)) return false
    const moved = tryInsertIntoChest(building, 'coal', 1)
    if (moved <= 0) {
      addItem('coal', 1)
      return false
    }
    return true
  }

  return false
}

export const storeOneCoalFromBuilding = storeOneCoalInBuilding

export function takeOneFromBuilding(building: Building) {
  if (building.type === 'wooden_chest') {
    const item = takeOneFromChestInternal(building)
    if (!item) return false
    addItem(item, 1)
    return true
  }

  if (building.type === 'transport_belt') {
    if (!building.item) return false
    addItem(building.item, 1)
    building.item = null
    building.itemProgress = 0
    return true
  }

  if (building.type === 'stone_furnace') {
    const item = takeOneFromFurnaceOutputInternal(building)
    if (!item) return false
    addItem(item, 1)
    return true
  }

  if (building.type === 'burner_drill') {
    const item = takeOneFromDrillOutputInternal(building)
    if (!item) return false
    addItem(item, 1)
    return true
  }

  if (building.type === 'burner_inserter') {
    if (!building.heldItem) return false
    addItem(building.heldItem, 1)
    building.heldItem = null
    building.progress = 0
    return true
  }

  return false
}

export function updateBuildings(dt: number) {
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