import { addItem, getItemCount, removeItem } from '../inventory'
import type { Building } from './types'
import { getBuildingAtTile } from './tile'
import { tryInsertIntoChest, takeOneFromChestInternal } from './chest'
import { takeOneFromDrillOutputInternal } from './drill'
import { takeOneFromFurnaceOutputInternal } from './furnace'

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
