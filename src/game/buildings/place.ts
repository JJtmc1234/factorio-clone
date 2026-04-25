import { addItem } from '../inventory'
import { getTileAtWorldTile } from '../world'
import type { BuildSelection, Direction } from './types'
import { isGroundBlockingObject, isMineableResource } from './items'
import { occupiesTile, getBuildingAtTile } from './tile'
import { addBuilding, getAllBuildings } from './store'
import { createWoodenChest } from './chest'
import { createTransportBelt } from './belts'
import { createBurnerDrill } from './drill'
import { createStoneFurnace } from './furnace'
import { createBurnerInserter } from './inserter'

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

export function placeBurnerDrill(tileX: number, tileY: number, direction: Direction) {
  if (!canPlaceBuilding('burner_drill', tileX, tileY)) return false
  addBuilding(createBurnerDrill(tileX, tileY, direction))
  return true
}

export function placeWoodenChest(tileX: number, tileY: number) {
  if (!canPlaceBuilding('wooden_chest', tileX, tileY)) return false
  addBuilding(createWoodenChest(tileX, tileY))
  return true
}

export function placeTransportBelt(tileX: number, tileY: number, direction: Direction) {
  if (!canPlaceBuilding('transport_belt', tileX, tileY)) return false
  addBuilding(createTransportBelt(tileX, tileY, direction))
  return true
}

export function placeStoneFurnace(tileX: number, tileY: number) {
  if (!canPlaceBuilding('stone_furnace', tileX, tileY)) return false
  addBuilding(createStoneFurnace(tileX, tileY))
  return true
}

export function placeBurnerInserter(tileX: number, tileY: number, direction: Direction) {
  if (!canPlaceBuilding('burner_inserter', tileX, tileY)) return false
  addBuilding(createBurnerInserter(tileX, tileY, direction))
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
  const buildings = getAllBuildings()
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
