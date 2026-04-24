import type { Building, Direction, ItemType } from './types'
import { getAllBuildings } from './state'
import { canBurnerConsumeItem, getFuelValue, isSmeltableInput } from './items'
import { tryInsertIntoChest, takeOneFromChestInternal } from './chest'
import { tryInsertIntoBelt } from './belts'
import { tryInsertIntoFurnace, takeOneFromFurnaceOutputInternal } from './furnace'
import { takeOneFromDrillOutputInternal } from './drill'
import { canInsertIntoInserter, tryInsertIntoInserter } from './inserter'

export function occupiesTile(building: Building, tileX: number, tileY: number) {
  if (
    building.type === 'wooden_chest' ||
    building.type === 'transport_belt' ||
    building.type === 'burner_inserter'
  ) {
    return building.tileX === tileX && building.tileY === tileY
  }

  return (
    tileX >= building.tileX &&
    tileX < building.tileX + 2 &&
    tileY >= building.tileY &&
    tileY < building.tileY + 2
  )
}

export function getFrontTile(tileX: number, tileY: number, direction: Direction) {
  if (direction === 'up') return { x: tileX, y: tileY - 1 }
  if (direction === 'right') return { x: tileX + 1, y: tileY }
  if (direction === 'down') return { x: tileX, y: tileY + 1 }
  return { x: tileX - 1, y: tileY }
}

export function getBackTile(tileX: number, tileY: number, direction: Direction) {
  if (direction === 'up') return { x: tileX, y: tileY + 1 }
  if (direction === 'right') return { x: tileX - 1, y: tileY }
  if (direction === 'down') return { x: tileX, y: tileY - 1 }
  return { x: tileX + 1, y: tileY }
}

export function getBuildingAtTile(tileX: number, tileY: number) {
  return getAllBuildings().find((building) => occupiesTile(building, tileX, tileY)) ?? null
}

export function removeBuildingAtTileReference(building: Building) {
  const buildings = getAllBuildings()
  const index = buildings.indexOf(building)
  if (index === -1) return false
  buildings.splice(index, 1)
  return true
}

export function canBuildingAcceptItem(building: Building, item: ItemType) {
  if (building.type === 'wooden_chest') {
    return building.count < building.capacity && (building.item === null || building.item === item)
  }

  if (building.type === 'transport_belt') {
    return building.item === null
  }

  if (building.type === 'stone_furnace') {
    if (isSmeltableInput(item)) {
      return (
        building.inputCount < building.inputCapacity &&
        (building.inputItem === null || building.inputItem === item)
      )
    }
    return canBurnerConsumeItem(item)
  }

  if (building.type === 'burner_drill') {
    return canBurnerConsumeItem(item)
  }

  return canInsertIntoInserter(building, item)
}

export function tryInsertIntoBuilding(building: Building, item: ItemType) {
  if (building.type === 'wooden_chest') {
    return tryInsertIntoChest(building, item, 1) > 0
  }

  if (building.type === 'transport_belt') {
    return tryInsertIntoBelt(building, item)
  }

  if (building.type === 'stone_furnace') {
    return tryInsertIntoFurnace(building, item)
  }

  if (building.type === 'burner_drill') {
    const fuelValue = getFuelValue(item)
    if (fuelValue <= 0) return false
    building.fuel += fuelValue
    return true
  }

  return tryInsertIntoInserter(building, item)
}

export function takeOneItemFromBuildingInternal(building: Building) {
  if (building.type === 'wooden_chest') return takeOneFromChestInternal(building)

  if (building.type === 'transport_belt') {
    if (!building.item || building.itemProgress < 0.45) return null
    const item = building.item
    building.item = null
    building.itemProgress = 0
    return item
  }

  if (building.type === 'stone_furnace') return takeOneFromFurnaceOutputInternal(building)
  if (building.type === 'burner_drill') return takeOneFromDrillOutputInternal(building)
  return null
}