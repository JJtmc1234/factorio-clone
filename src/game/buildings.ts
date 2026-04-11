import { worldToScreen } from './camera'
  import { getGameSprite } from '../components/gameSprites'
  import { addItem, getItemCount, removeItem } from './inventory'
  import { TILE_SIZE, getTileAtWorldTile, isTileExplored, isTileVisible } from './world'
  
  export type Direction = 'up' | 'right' | 'down' | 'left'
  export type BuildingType =
    | 'burner_drill'
    | 'wooden_chest'
    | 'transport_belt'
    | 'stone_furnace'
    | 'burner_inserter'
  export type BuildSelection = BuildingType | null
  export type ItemType = 'iron_ore' | 'coal' | 'wood' | 'iron_plate'
  
  export interface BurnerDrill {
    type: 'burner_drill'
    tileX: number
    tileY: number
    direction: Direction
    fuel: number
    progress: number
    outputItem: ItemType | null
    outputCount: number
    outputCapacity: number
  }
  
  export interface WoodenChest {
    type: 'wooden_chest'
    tileX: number
    tileY: number
    item: ItemType | null
    count: number
    capacity: number
  }
  
  export interface TransportBelt {
    type: 'transport_belt'
    tileX: number
    tileY: number
    direction: Direction
    item: ItemType | null
    itemProgress: number
  }
  
  export interface StoneFurnace {
    type: 'stone_furnace'
    tileX: number
    tileY: number
    fuel: number
    progress: number
    inputItem: ItemType | null
    inputCount: number
    inputCapacity: number
    outputItem: ItemType | null
    outputCount: number
    outputCapacity: number
  }
  
  export interface BurnerInserter {
    type: 'burner_inserter'
    tileX: number
    tileY: number
    direction: Direction
    fuel: number
    progress: number
    heldItem: ItemType | null
  }
  
  export type Building = BurnerDrill | WoodenChest | TransportBelt | StoneFurnace | BurnerInserter
  
  const buildings: Building[] = []
  
  function isMineableResource(type: string | undefined): type is ItemType {
    return type === 'iron_ore' || type === 'coal'
  }
  
  function isSmeltableInput(item: ItemType | null): item is 'iron_ore' {
    return item === 'iron_ore'
  }
  
  function occupiesTile(building: Building, tileX: number, tileY: number) {
    if (building.type === 'wooden_chest' || building.type === 'transport_belt' || building.type === 'burner_inserter') {
      return building.tileX === tileX && building.tileY === tileY
    }
  
    return (
      tileX >= building.tileX &&
      tileX < building.tileX + 2 &&
      tileY >= building.tileY &&
      tileY < building.tileY + 2
    )
  }
  
  function getFrontTile(tileX: number, tileY: number, direction: Direction) {
    if (direction === 'up') return { x: tileX, y: tileY - 1 }
    if (direction === 'right') return { x: tileX + 1, y: tileY }
    if (direction === 'down') return { x: tileX, y: tileY + 1 }
    return { x: tileX - 1, y: tileY }
  }
  
  function getBackTile(tileX: number, tileY: number, direction: Direction) {
    if (direction === 'up') return { x: tileX, y: tileY + 1 }
    if (direction === 'right') return { x: tileX - 1, y: tileY }
    if (direction === 'down') return { x: tileX, y: tileY - 1 }
    return { x: tileX + 1, y: tileY }
  }
  
  function getFuelValue(item: ItemType) {
    if (item === 'coal') return 8
    if (item === 'wood') return 5
    return 0
  }
  
  function isGroundBlockingObject(type: string | undefined) {
    return type === 'tree'
  }
  
  function getDrillCoveredTiles(drill: BurnerDrill) {
    return [
      { x: drill.tileX, y: drill.tileY },
      { x: drill.tileX + 1, y: drill.tileY },
      { x: drill.tileX, y: drill.tileY + 1 },
      { x: drill.tileX + 1, y: drill.tileY + 1 },
    ]
  }
  
  function getFurnaceCoveredTiles(furnace: StoneFurnace) {
    return [
      { x: furnace.tileX, y: furnace.tileY },
      { x: furnace.tileX + 1, y: furnace.tileY },
      { x: furnace.tileX, y: furnace.tileY + 1 },
      { x: furnace.tileX + 1, y: furnace.tileY + 1 },
    ]
  }
  
  function getFurnaceOutputTile(furnace: StoneFurnace) {
    return { x: furnace.tileX + 2, y: furnace.tileY + 1 }
  }
  
  function getDrillMiningTile(drill: BurnerDrill) {
    for (const tilePos of getDrillCoveredTiles(drill)) {
      const tile = getTileAtWorldTile(tilePos.x, tilePos.y)
      if (tile.object && isMineableResource(tile.object.type)) {
        return tilePos
      }
    }
    return null
  }
  
  function getDrillOutputTile(drill: BurnerDrill) {
    if (drill.direction === 'up') return { x: drill.tileX + 1, y: drill.tileY - 1 }
    if (drill.direction === 'right') return { x: drill.tileX + 2, y: drill.tileY + 1 }
    if (drill.direction === 'down') return { x: drill.tileX + 1, y: drill.tileY + 2 }
    return { x: drill.tileX - 1, y: drill.tileY + 1 }
  }
  
  function canAcceptDrillOutput(drill: BurnerDrill, item: ItemType) {
    if (drill.outputCount >= drill.outputCapacity) return false
    if (drill.outputItem === null) return true
    return drill.outputItem === item
  }
  
  function addDrillOutput(drill: BurnerDrill, item: ItemType) {
    if (!canAcceptDrillOutput(drill, item)) return false
  
    if (drill.outputItem === null) {
      drill.outputItem = item
    }
  
    drill.outputCount += 1
    return true
  }
  
  function tryInsertIntoChest(chest: WoodenChest, item: ItemType, count: number) {
    if (chest.count >= chest.capacity) return 0
    if (chest.item !== null && chest.item !== item) return 0
  
    if (chest.item === null) {
      chest.item = item
    }
  
    const moved = Math.min(chest.capacity - chest.count, count)
    chest.count += moved
    return moved
  }
  
  function consumeCoalFromChest(chest: WoodenChest) {
    if (chest.item !== 'coal' || chest.count <= 0) return false
  
    chest.count -= 1
    if (chest.count <= 0) {
      chest.count = 0
      chest.item = null
    }
  
    return true
  }
  
  function consumeCoalFromDrill(drill: BurnerDrill) {
    if (drill.outputItem !== 'coal' || drill.outputCount <= 0) return false
  
    drill.outputCount -= 1
    if (drill.outputCount <= 0) {
      drill.outputCount = 0
      drill.outputItem = null
    }
  
    return true
  }
  
  function tryAutoFuelDrill(drill: BurnerDrill) {
    if (drill.fuel > 1.5) return
  
    const outputTile = getDrillOutputTile(drill)
    const target = getBuildingAtTile(outputTile.x, outputTile.y)
  
    if (!target) return
  
    if (target.type === 'wooden_chest' && consumeCoalFromChest(target)) {
      drill.fuel += 8
      return
    }
  
    if (target.type === 'burner_drill' && consumeCoalFromDrill(target)) {
      drill.fuel += 8
    }
  }
  
  function tryInsertIntoBelt(belt: TransportBelt, item: ItemType) {
    if (belt.item !== null) return false
    belt.item = item
    belt.itemProgress = 0
    return true
  }
  
  function tryInsertIntoFurnace(furnace: StoneFurnace, item: ItemType) {
    if (item === 'iron_ore') {
      if (furnace.inputCount >= furnace.inputCapacity) return false
      if (furnace.inputItem !== null && furnace.inputItem !== item) return false
      furnace.inputItem = 'iron_ore'
      furnace.inputCount += 1
      return true
    }
  
    if (item === 'coal') {
      furnace.fuel += 8
      return true
    }
  
    if (item === 'wood') {
      furnace.fuel += 5
      return true
    }
  
    return false
  }
  
  function tryPushDrillOutput(drill: BurnerDrill) {
    if (!drill.outputItem || drill.outputCount <= 0) return
  
    const outputTile = getDrillOutputTile(drill)
    const target = getBuildingAtTile(outputTile.x, outputTile.y)
  
    if (!target) return
  
    if (target.type === 'wooden_chest') {
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
  
  
  function canBurnerConsumeItem(item: ItemType) {
    return item === 'coal' || item === 'wood'
  }
  
  function canInsertIntoInserter(inserter: BurnerInserter, item: ItemType) {
    return inserter.heldItem === null && canBurnerConsumeItem(item)
  }
  
  function tryInsertIntoInserter(inserter: BurnerInserter, item: ItemType) {
    if (!canInsertIntoInserter(inserter, item)) return false
    inserter.fuel += getFuelValue(item)
    return true
  }
  
  function canBuildingAcceptItem(building: Building, item: ItemType) {
    if (building.type === 'wooden_chest') {
      return building.count < building.capacity && (building.item === null || building.item === item)
    }
  
    if (building.type === 'transport_belt') {
      return building.item === null
    }
  
    if (building.type === 'stone_furnace') {
      if (item === 'iron_ore') {
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
  
  function tryInsertIntoBuilding(building: Building, item: ItemType) {
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
  
  function takeOneFromChestInternal(chest: WoodenChest) {
    if (!chest.item || chest.count <= 0) return null
    const item = chest.item
    chest.count -= 1
    if (chest.count <= 0) {
      chest.count = 0
      chest.item = null
    }
    return item
  }
  
  function takeOneFromDrillOutputInternal(drill: BurnerDrill) {
    if (!drill.outputItem || drill.outputCount <= 0) return null
    const item = drill.outputItem
    drill.outputCount -= 1
    if (drill.outputCount <= 0) {
      drill.outputCount = 0
      drill.outputItem = null
    }
    return item
  }
  
  function takeOneFromFurnaceOutputInternal(furnace: StoneFurnace) {
    if (!furnace.outputItem || furnace.outputCount <= 0) return null
    const item = furnace.outputItem
    furnace.outputCount -= 1
    if (furnace.outputCount <= 0) {
      furnace.outputCount = 0
      furnace.outputItem = null
    }
    return item
  }
  
  function takeOneItemFromBuildingInternal(building: Building) {
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
  
  function getInserterPickupTile(inserter: BurnerInserter) {
    return getBackTile(inserter.tileX, inserter.tileY, inserter.direction)
  }
  
  function getInserterDropTile(inserter: BurnerInserter) {
    return getFrontTile(inserter.tileX, inserter.tileY, inserter.direction)
  }
  
  function updateInserter(inserter: BurnerInserter, dt: number) {
    if (inserter.heldItem === null) {
      if (inserter.fuel <= 0) {
        inserter.progress = 0
        return
      }
  
      const pickupTile = getInserterPickupTile(inserter)
      const source = getBuildingAtTile(pickupTile.x, pickupTile.y)
      if (!source) {
        inserter.progress = 0
        return
      }
  
      const item = takeOneItemFromBuildingInternal(source)
      if (!item) {
        inserter.progress = 0
        return
      }
  
      inserter.heldItem = item
      inserter.fuel = Math.max(0, inserter.fuel - Math.min(dt, inserter.fuel))
      inserter.progress += dt * 3
      if (inserter.progress >= 1) inserter.progress = 1
      return
    }
  
    const dropTile = getInserterDropTile(inserter)
    const target = getBuildingAtTile(dropTile.x, dropTile.y)
    if (!target || !canBuildingAcceptItem(target, inserter.heldItem)) {
      inserter.progress = 1
      return
    }
  
    if (inserter.fuel <= 0) return
  
    inserter.fuel = Math.max(0, inserter.fuel - dt)
    inserter.progress += dt * 3
  
    if (inserter.progress < 1) return
  
    if (tryInsertIntoBuilding(target, inserter.heldItem)) {
      inserter.heldItem = null
      inserter.progress = 0
    } else {
      inserter.progress = 1
    }
  }
  
  function updateBelt(belt: TransportBelt, dt: number) {
    if (!belt.item) return
  
    belt.itemProgress += dt * 2.2
    if (belt.itemProgress < 1) return
  
    const nextTile = getFrontTile(belt.tileX, belt.tileY, belt.direction)
    const target = getBuildingAtTile(nextTile.x, nextTile.y)
  
    if (!target) {
      belt.itemProgress = 1
      return
    }
  
    if (target.type === 'transport_belt') {
      if (target.item === null) {
        target.item = belt.item
        target.itemProgress = 0
        belt.item = null
        belt.itemProgress = 0
      } else {
        belt.itemProgress = 1
      }
      return
    }
  
    if (target.type === 'wooden_chest') {
      const moved = tryInsertIntoChest(target, belt.item, 1)
      if (moved > 0) {
        belt.item = null
        belt.itemProgress = 0
      } else {
        belt.itemProgress = 1
      }
      return
    }
  
    if (target.type === 'stone_furnace') {
      if (tryInsertIntoFurnace(target, belt.item)) {
        belt.item = null
        belt.itemProgress = 0
      } else {
        belt.itemProgress = 1
      }
      return
    }
  
    belt.itemProgress = 1
  }
  
  function updateFurnace(furnace: StoneFurnace, dt: number) {
    if (furnace.outputCount > 0) {
      const outputTile = getFurnaceOutputTile(furnace)
      const target = getBuildingAtTile(outputTile.x, outputTile.y)
  
      if (target?.type === 'transport_belt' && furnace.outputItem) {
        if (tryInsertIntoBelt(target, furnace.outputItem)) {
          furnace.outputCount -= 1
          if (furnace.outputCount <= 0) {
            furnace.outputCount = 0
            furnace.outputItem = null
          }
        }
      } else if (target?.type === 'wooden_chest' && furnace.outputItem) {
        const moved = tryInsertIntoChest(target, furnace.outputItem, 1)
        if (moved > 0) {
          furnace.outputCount -= moved
          if (furnace.outputCount <= 0) {
            furnace.outputCount = 0
            furnace.outputItem = null
          }
        }
      }
    }
  
    if (furnace.fuel <= 0) return
    if (!isSmeltableInput(furnace.inputItem)) return
    if (furnace.inputCount <= 0) return
    if (furnace.outputCount >= furnace.outputCapacity) return
    if (furnace.outputItem !== null && furnace.outputItem !== 'iron_plate') return
  
    furnace.fuel = Math.max(0, furnace.fuel - dt)
    furnace.progress += dt * 0.4
  
    while (furnace.progress >= 1) {
      if (furnace.fuel <= 0) {
        furnace.progress = 0
        break
      }
      if (!isSmeltableInput(furnace.inputItem) || furnace.inputCount <= 0) {
        furnace.progress = 0
        break
      }
      if (furnace.outputCount >= furnace.outputCapacity) {
        furnace.progress = 0.999
        break
      }
  
      furnace.inputCount -= 1
      if (furnace.inputCount <= 0) {
        furnace.inputCount = 0
        furnace.inputItem = null
      }
  
      furnace.outputItem = 'iron_plate'
      furnace.outputCount += 1
      furnace.progress -= 1
    }
  }
  
  export function getBuildingAtTile(tileX: number, tileY: number) {
    return buildings.find((building) => occupiesTile(building, tileX, tileY)) ?? null
  }
  
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
  
  export function placeBurnerDrill(tileX: number, tileY: number, direction: Direction) {
    if (!canPlaceBuilding('burner_drill', tileX, tileY)) return false
  
    buildings.push({
      type: 'burner_drill',
      tileX,
      tileY,
      direction,
      fuel: 0,
      progress: 0,
      outputItem: null,
      outputCount: 0,
      outputCapacity: 8,
    })
  
    return true
  }
  
  export function placeWoodenChest(tileX: number, tileY: number) {
    if (!canPlaceBuilding('wooden_chest', tileX, tileY)) return false
  
    buildings.push({
      type: 'wooden_chest',
      tileX,
      tileY,
      item: null,
      count: 0,
      capacity: 50,
    })
  
    return true
  }
  
  export function placeTransportBelt(tileX: number, tileY: number, direction: Direction) {
    if (!canPlaceBuilding('transport_belt', tileX, tileY)) return false
  
    buildings.push({
      type: 'transport_belt',
      tileX,
      tileY,
      direction,
      item: null,
      itemProgress: 0,
    })
  
    return true
  }
  
  export function placeStoneFurnace(tileX: number, tileY: number) {
    if (!canPlaceBuilding('stone_furnace', tileX, tileY)) return false
  
    buildings.push({
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
    })
  
    return true
  }
  
  export function placeBurnerInserter(tileX: number, tileY: number, direction: Direction) {
    if (!canPlaceBuilding('burner_inserter', tileX, tileY)) return false
  
    buildings.push({
      type: 'burner_inserter',
      tileX,
      tileY,
      direction,
      fuel: 0,
      progress: 0,
      heldItem: null,
    })
  
    return true
  }
  
  export function removeBuildingAtTile(tileX: number, tileY: number) {
    const index = buildings.findIndex((building) => occupiesTile(building, tileX, tileY))
    if (index === -1) return false
  
    const building = buildings[index]
  
    if (building.type === 'wooden_chest' && building.item && building.count > 0) {
      addItem(building.item, building.count)
    }
  
    if (building.type === 'burner_drill' && building.outputItem && building.outputCount > 0) {
      addItem(building.outputItem, building.outputCount)
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
  
    if (building.type === 'burner_inserter' && building.heldItem) {
      addItem(building.heldItem, 1)
    }
  
    buildings.splice(index, 1)
    return true
  }
  
  export function fuelBuildingAtTile(tileX: number, tileY: number) {
    const building = getBuildingAtTile(tileX, tileY)
    if (!building) return false
  
    if (building.type === 'burner_drill' || building.type === 'stone_furnace' || building.type === 'burner_inserter') {
      if (getItemCount('coal') > 0 && removeItem('coal', 1)) {
        building.fuel += 8
        return true
      }
  
      if (getItemCount('wood') > 0 && removeItem('wood', 1)) {
        building.fuel += 5
        return true
      }
    }
  
    return false
  }
  
  export function takeOneFromBuilding(building: Building) {
    if (building.type === 'wooden_chest') {
      if (!building.item || building.count <= 0) return false
      addItem(building.item, 1)
      building.count -= 1
      if (building.count <= 0) {
        building.count = 0
        building.item = null
      }
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
      if (!building.outputItem || building.outputCount <= 0) return false
      addItem(building.outputItem, 1)
      building.outputCount -= 1
      if (building.outputCount <= 0) {
        building.outputCount = 0
        building.outputItem = null
      }
      return true
    }
  
    if (building.type === 'burner_inserter') {
      if (!building.heldItem) return false
      addItem(building.heldItem, 1)
      building.heldItem = null
      building.progress = 0
      return true
    }
  
    if (!building.outputItem || building.outputCount <= 0) return false
    addItem(building.outputItem, 1)
    building.outputCount -= 1
    if (building.outputCount <= 0) {
      building.outputCount = 0
      building.outputItem = null
    }
    return true
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
  
    if (building.type === 'transport_belt') {
      if (building.item !== null) return false
      if (!removeItem('coal', 1)) return false
      building.item = 'coal'
      building.itemProgress = 0
      return true
    }
  
    if (building.type === 'stone_furnace' || building.type === 'burner_inserter') {
      if (!removeItem('coal', 1)) return false
      building.fuel += 8
      return true
    }
  
    if (!removeItem('coal', 1)) return false
    building.fuel += 8
    return true
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
  
  
  function drawDirectionMarker(
    ctx: CanvasRenderingContext2D,
    screenX: number,
    screenY: number,
    direction: Direction,
    size: number,
    color = '#ffd54f',
  ) {
    ctx.fillStyle = color
  
    if (direction === 'up') ctx.fillRect(screenX + size / 2 - 8, screenY + 4, 16, 6)
    if (direction === 'right') ctx.fillRect(screenX + size - 10, screenY + size / 2 - 8, 6, 16)
    if (direction === 'down') ctx.fillRect(screenX + size / 2 - 8, screenY + size - 10, 16, 6)
    if (direction === 'left') ctx.fillRect(screenX + 4, screenY + size / 2 - 8, 6, 16)
  }
  
  function drawFallbackBurnerDrillSprite(
    ctx: CanvasRenderingContext2D,
    screenX: number,
    screenY: number,
    drill: BurnerDrill,
    alpha = 1,
  ) {
    const size = TILE_SIZE * 2
  
    ctx.save()
    ctx.globalAlpha = alpha
  
    ctx.fillStyle = '#6b4a2d'
    ctx.fillRect(screenX + 4, screenY + 4, size - 8, size - 8)
  
    ctx.fillStyle = '#8c6239'
    ctx.fillRect(screenX + 8, screenY + 8, size - 16, size - 16)
  
    ctx.fillStyle = '#4f555d'
    ctx.fillRect(screenX + 18, screenY + 16, size - 36, size - 34)
  
    ctx.fillStyle = '#2c3138'
    ctx.fillRect(screenX + 24, screenY + 22, size - 48, size - 46)
  
    ctx.fillStyle = '#cc6b2c'
    ctx.fillRect(screenX + size - 18, screenY + 12, 8, 18)
  
    drawDirectionMarker(ctx, screenX, screenY, drill.direction, size)
  
    ctx.fillStyle = 'black'
    ctx.fillRect(screenX + 8, screenY + size - 10, size - 16, 6)
  
    const fuelRatio = Math.min(drill.fuel / 12, 1)
    ctx.fillStyle = fuelRatio > 0 ? '#ff9800' : '#555'
    ctx.fillRect(screenX + 8, screenY + size - 10, (size - 16) * fuelRatio, 6)
  
    if (drill.outputCount > 0) {
      ctx.fillStyle = drill.outputItem === 'coal' ? '#1a1a1d' : '#c0c6cf'
      ctx.fillRect(screenX + 12, screenY + size - 24, 12, 8)
    }
  
    ctx.restore()
  }
  
  function drawFallbackChestSprite(
    ctx: CanvasRenderingContext2D,
    screenX: number,
    screenY: number,
    chest: WoodenChest,
    alpha = 1,
  ) {
    ctx.save()
    ctx.globalAlpha = alpha
  
    ctx.fillStyle = '#6d4526'
    ctx.fillRect(screenX + 4, screenY + 8, 24, 18)
  
    ctx.fillStyle = '#8a5a32'
    ctx.fillRect(screenX + 4, screenY + 6, 24, 5)
  
    ctx.fillStyle = '#3a2513'
    ctx.fillRect(screenX + 15, screenY + 11, 2, 5)
  
    if (chest.count > 0) {
      ctx.fillStyle = chest.item === 'coal' ? '#1a1a1d' : '#c0c6cf'
      ctx.fillRect(screenX + 10, screenY + 15, 12, 6)
    }
  
    ctx.restore()
  }
  
  function drawFallbackBeltSprite(
    ctx: CanvasRenderingContext2D,
    screenX: number,
    screenY: number,
    belt: TransportBelt,
    alpha = 1,
  ) {
    ctx.save()
    ctx.globalAlpha = alpha
  
    ctx.fillStyle = '#7f6a52'
    ctx.fillRect(screenX + 2, screenY + 2, TILE_SIZE - 4, TILE_SIZE - 4)
  
    ctx.fillStyle = '#4f4335'
    if (belt.direction === 'up' || belt.direction === 'down') {
      ctx.fillRect(screenX + 12, screenY + 4, 8, TILE_SIZE - 8)
    } else {
      ctx.fillRect(screenX + 4, screenY + 12, TILE_SIZE - 8, 8)
    }
  
    ctx.fillStyle = '#c7a66a'
    if (belt.direction === 'up') {
      ctx.beginPath()
      ctx.moveTo(screenX + 16, screenY + 6)
      ctx.lineTo(screenX + 10, screenY + 14)
      ctx.lineTo(screenX + 22, screenY + 14)
      ctx.closePath()
      ctx.fill()
    } else if (belt.direction === 'right') {
      ctx.beginPath()
      ctx.moveTo(screenX + 26, screenY + 16)
      ctx.lineTo(screenX + 18, screenY + 10)
      ctx.lineTo(screenX + 18, screenY + 22)
      ctx.closePath()
      ctx.fill()
    } else if (belt.direction === 'down') {
      ctx.beginPath()
      ctx.moveTo(screenX + 16, screenY + 26)
      ctx.lineTo(screenX + 10, screenY + 18)
      ctx.lineTo(screenX + 22, screenY + 18)
      ctx.closePath()
      ctx.fill()
    } else {
      ctx.beginPath()
      ctx.moveTo(screenX + 6, screenY + 16)
      ctx.lineTo(screenX + 14, screenY + 10)
      ctx.lineTo(screenX + 14, screenY + 22)
      ctx.closePath()
      ctx.fill()
    }
  
    ctx.restore()
  }
  
  function drawFallbackFurnaceSprite(
    ctx: CanvasRenderingContext2D,
    screenX: number,
    screenY: number,
    furnace: StoneFurnace,
    alpha = 1,
  ) {
    const size = TILE_SIZE * 2
  
    ctx.save()
    ctx.globalAlpha = alpha
  
    ctx.fillStyle = '#5d5d5d'
    ctx.fillRect(screenX + 4, screenY + 4, size - 8, size - 8)
  
    ctx.fillStyle = '#787878'
    ctx.fillRect(screenX + 8, screenY + 8, size - 16, size - 16)
  
    ctx.fillStyle = '#2f2f2f'
    ctx.fillRect(screenX + 18, screenY + 16, size - 36, size - 30)
  
    ctx.fillStyle = '#111'
    ctx.fillRect(screenX + 24, screenY + 22, size - 48, size - 42)
  
    ctx.fillStyle = furnace.fuel > 0 ? '#ff7a1a' : '#444'
    ctx.fillRect(screenX + 28, screenY + 30, size - 56, 14)
  
    ctx.fillStyle = 'black'
    ctx.fillRect(screenX + 8, screenY + size - 10, size - 16, 6)
  
    const fuelRatio = Math.min(furnace.fuel / 12, 1)
    ctx.fillStyle = fuelRatio > 0 ? '#ff9800' : '#555'
    ctx.fillRect(screenX + 8, screenY + size - 10, (size - 16) * fuelRatio, 6)
  
    if (furnace.outputCount > 0) {
      ctx.fillStyle = '#cfd5dd'
      ctx.fillRect(screenX + size - 22, screenY + 10, 12, 10)
    }
  
    ctx.restore()
  }
  
  
  function drawFallbackInserterSprite(
    ctx: CanvasRenderingContext2D,
    screenX: number,
    screenY: number,
    inserter: BurnerInserter,
    alpha = 1,
  ) {
    ctx.save()
    ctx.globalAlpha = alpha
  
    ctx.fillStyle = '#6c4b2a'
    ctx.fillRect(screenX + 8, screenY + 8, 16, 16)
  
    const armRotation =
      inserter.direction === 'right'
        ? 0
        : inserter.direction === 'down'
          ? Math.PI / 2
          : inserter.direction === 'left'
            ? Math.PI
            : -Math.PI / 2
  
    const swing = inserter.heldItem ? -0.9 + inserter.progress * 0.9 : 0.9 - inserter.progress * 0.9
  
    ctx.translate(screenX + TILE_SIZE / 2, screenY + TILE_SIZE / 2)
    ctx.rotate(armRotation + swing)
  
    ctx.fillStyle = '#b58b57'
    ctx.fillRect(-3, -14, 6, 18)
    ctx.fillStyle = '#ddd'
    ctx.fillRect(-4, -18, 8, 6)
  
    if (inserter.heldItem) {
      ctx.fillStyle =
        inserter.heldItem === 'coal'
          ? '#1a1a1d'
          : inserter.heldItem === 'iron_plate'
            ? '#d9dee6'
            : inserter.heldItem === 'wood'
              ? '#8b5a2b'
              : '#c0c6cf'
      ctx.fillRect(-4, -24, 8, 8)
    }
  
    ctx.restore()
  
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = 'black'
    ctx.fillRect(screenX + 5, screenY + TILE_SIZE - 7, TILE_SIZE - 10, 4)
    const fuelRatio = Math.min(inserter.fuel / 12, 1)
    ctx.fillStyle = fuelRatio > 0 ? '#ff9800' : '#555'
    ctx.fillRect(screenX + 5, screenY + TILE_SIZE - 7, (TILE_SIZE - 10) * fuelRatio, 4)
    ctx.restore()
  }
  
  function drawInserterSprite(
    ctx: CanvasRenderingContext2D,
    screenX: number,
    screenY: number,
    inserter: BurnerInserter,
    alpha = 1,
  ) {
    drawFallbackInserterSprite(ctx, screenX, screenY, inserter, alpha)
  }
  
  function getDrillRotation(direction: Direction) {
    if (direction === 'right') return 0
    if (direction === 'down') return Math.PI / 2
    if (direction === 'left') return Math.PI
    return -Math.PI / 2
  }
  
  function drawSpriteRotated(
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
  
  function drawBurnerDrillSprite(
    ctx: CanvasRenderingContext2D,
    screenX: number,
    screenY: number,
    drill: BurnerDrill,
    alpha = 1,
  ) {
    const sprite = getGameSprite('burner_drill')
    const size = TILE_SIZE * 2
  
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
  
      ctx.fillStyle = 'black'
      ctx.fillRect(screenX + 8, screenY + size - 10, size - 16, 6)
  
      const fuelRatio = Math.min(drill.fuel / 12, 1)
      ctx.fillStyle = fuelRatio > 0 ? '#ff9800' : '#555'
      ctx.fillRect(screenX + 8, screenY + size - 10, (size - 16) * fuelRatio, 6)
  
      if (drill.outputCount > 0) {
        ctx.fillStyle = drill.outputItem === 'coal' ? '#1a1a1d' : '#c0c6cf'
        ctx.fillRect(screenX + 12, screenY + size - 24, 12, 8)
      }
  
      ctx.restore()
      return
    }
  
    drawFallbackBurnerDrillSprite(ctx, screenX, screenY, drill, alpha)
  }
  
  function drawChestSprite(
    ctx: CanvasRenderingContext2D,
    screenX: number,
    screenY: number,
    chest: WoodenChest,
    alpha = 1,
  ) {
    const sprite = getGameSprite('wooden_chest')
  
    if (sprite && sprite.complete && sprite.naturalWidth > 0) {
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.drawImage(sprite, screenX, screenY, TILE_SIZE, TILE_SIZE)
  
      if (chest.count > 0) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
        ctx.fillRect(screenX + 2, screenY + 2, 18, 12)
        ctx.fillStyle = 'white'
        ctx.font = '10px sans-serif'
        ctx.fillText(String(chest.count), screenX + 5, screenY + 11)
      }
  
      ctx.restore()
      return
    }
  
    drawFallbackChestSprite(ctx, screenX, screenY, chest, alpha)
  }
  
  function getBeltItemOffset(direction: Direction, progress: number) {
    if (direction === 'up') return { x: 16, y: 24 - progress * 16 }
    if (direction === 'right') return { x: 8 + progress * 16, y: 16 }
    if (direction === 'down') return { x: 16, y: 8 + progress * 16 }
    return { x: 24 - progress * 16, y: 16 }
  }
  
  function drawBeltItem(
    ctx: CanvasRenderingContext2D,
    screenX: number,
    screenY: number,
    belt: TransportBelt,
  ) {
    if (!belt.item) return
  
    const offset = getBeltItemOffset(belt.direction, belt.itemProgress)
    ctx.fillStyle = belt.item === 'coal' ? '#1a1a1d' : belt.item === 'iron_plate' ? '#d9dee6' : '#c0c6cf'
    ctx.fillRect(screenX + offset.x - 4, screenY + offset.y - 4, 8, 8)
  }
  
  function drawBeltSprite(
    ctx: CanvasRenderingContext2D,
    screenX: number,
    screenY: number,
    belt: TransportBelt,
    alpha = 1,
  ) {
    drawFallbackBeltSprite(ctx, screenX, screenY, belt, alpha)
    if (alpha >= 1) {
      drawBeltItem(ctx, screenX, screenY, belt)
    }
  }
  
  function drawFurnaceSprite(
    ctx: CanvasRenderingContext2D,
    screenX: number,
    screenY: number,
    furnace: StoneFurnace,
    alpha = 1,
  ) {
    drawFallbackFurnaceSprite(ctx, screenX, screenY, furnace, alpha)
  }
  
  export function renderBuildings(ctx: CanvasRenderingContext2D) {
    for (const building of buildings) {
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
        drawInserterSprite(ctx, screen.x, screen.y, building)
      }
  
      if (!isTileVisible(building.tileX, building.tileY)) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
        ctx.fillRect(screen.x, screen.y, TILE_SIZE, TILE_SIZE)
      }
    }
  }
  
  export function renderBuildingGhost(
    ctx: CanvasRenderingContext2D,
    type: Exclude<BuildSelection, null>,
    tileX: number,
    tileY: number,
    direction: Direction,
    valid: boolean,
  ) {
    const screen = worldToScreen(tileX * TILE_SIZE, tileY * TILE_SIZE)
  
    if (type === 'burner_drill') {
      drawBurnerDrillSprite(
        ctx,
        screen.x,
        screen.y,
        {
          type: 'burner_drill',
          tileX,
          tileY,
          direction,
          fuel: 5,
          progress: 0,
          outputItem: null,
          outputCount: 0,
          outputCapacity: 8,
        },
        0.55,
      )
  
      ctx.strokeStyle = valid ? '#00e5ff' : '#ff5252'
      ctx.lineWidth = 2
      ctx.strokeRect(screen.x + 1, screen.y + 1, TILE_SIZE * 2 - 2, TILE_SIZE * 2 - 2)
      return
    }
  
    if (type === 'stone_furnace') {
      drawFurnaceSprite(
        ctx,
        screen.x,
        screen.y,
        {
          type: 'stone_furnace',
          tileX,
          tileY,
          fuel: 5,
          progress: 0,
          inputItem: 'iron_ore',
          inputCount: 1,
          inputCapacity: 8,
          outputItem: null,
          outputCount: 0,
          outputCapacity: 8,
        },
        0.55,
      )
  
      ctx.strokeStyle = valid ? '#00e5ff' : '#ff5252'
      ctx.lineWidth = 2
      ctx.strokeRect(screen.x + 1, screen.y + 1, TILE_SIZE * 2 - 2, TILE_SIZE * 2 - 2)
      return
    }
  
    if (type === 'wooden_chest') {
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
        0.55,
      )
    } else if (type === 'transport_belt') {
      drawBeltSprite(
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
        0.55,
      )
    } else {
      drawInserterSprite(
        ctx,
        screen.x,
        screen.y,
        {
          type: 'burner_inserter',
          tileX,
          tileY,
          direction,
          fuel: 5,
          progress: 0,
          heldItem: null,
        },
        0.55,
      )
    }
  
    ctx.strokeStyle = valid ? '#00e5ff' : '#ff5252'
    ctx.lineWidth = 2
    ctx.strokeRect(screen.x + 1, screen.y + 1, TILE_SIZE - 2, TILE_SIZE - 2)
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