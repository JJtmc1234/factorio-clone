import { worldToScreen } from './camera'
import { addItem, getItemCount, removeItem } from './inventory'
import { spawnGroundItem } from './groundItems'
import { TILE_SIZE, getTileAtWorldTile, isTileExplored, isTileVisible } from './world'

export type Direction = 'up' | 'right' | 'down' | 'left'
export type BuildingType = 'burner_drill' | 'wooden_chest'
export type BuildSelection = BuildingType | null
export type ItemType = 'iron_ore' | 'coal'

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

export type Building = BurnerDrill | WoodenChest

const buildings = new Map<string, Building>()

function getKey(tileX: number, tileY: number) {
  return `${tileX},${tileY}`
}

function getFrontTile(tileX: number, tileY: number, direction: Direction) {
  if (direction === 'up') return { x: tileX, y: tileY - 1 }
  if (direction === 'right') return { x: tileX + 1, y: tileY }
  if (direction === 'down') return { x: tileX, y: tileY + 1 }
  return { x: tileX - 1, y: tileY }
}

function isMineableResource(type: string | undefined): type is ItemType {
  return type === 'iron_ore' || type === 'coal'
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

  const front = getFrontTile(drill.tileX, drill.tileY, drill.direction)
  const target = getBuildingAtTile(front.x, front.y)

  if (!target) return

  if (target.type === 'wooden_chest' && consumeCoalFromChest(target)) {
    drill.fuel += 8
    return
  }

  if (target.type === 'burner_drill' && consumeCoalFromDrill(target)) {
    drill.fuel += 8
  }
}

function dropOneDrillOutputToGround(drill: BurnerDrill) {
  if (!drill.outputItem || drill.outputCount <= 0) return false

  const front = getFrontTile(drill.tileX, drill.tileY, drill.direction)
  spawnGroundItem(front.x, front.y, drill.outputItem, 1)

  drill.outputCount -= 1
  if (drill.outputCount <= 0) {
    drill.outputCount = 0
    drill.outputItem = null
  }

  return true
}

function tryPushDrillOutput(drill: BurnerDrill) {
  if (!drill.outputItem || drill.outputCount <= 0) return

  const front = getFrontTile(drill.tileX, drill.tileY, drill.direction)
  const target = getBuildingAtTile(front.x, front.y)

  if (!target) {
    dropOneDrillOutputToGround(drill)
    return
  }

  if (target.type === 'wooden_chest') {
    const moved = tryInsertIntoChest(target, drill.outputItem, 1)
    if (moved > 0) {
      drill.outputCount -= moved
      if (drill.outputCount <= 0) {
        drill.outputCount = 0
        drill.outputItem = null
      }
      return
    }

    dropOneDrillOutputToGround(drill)
    return
  }

  if (target.type === 'burner_drill' && drill.outputItem === 'coal' && target.fuel <= 5) {
    drill.outputCount -= 1
    if (drill.outputCount <= 0) {
      drill.outputCount = 0
      drill.outputItem = null
    }
    target.fuel += 8
    return
  }

  dropOneDrillOutputToGround(drill)
}

export function getBuildingAtTile(tileX: number, tileY: number) {
  return buildings.get(getKey(tileX, tileY)) ?? null
}

export function getAllBuildings() {
  return [...buildings.values()]
}

export function canPlaceBuilding(
  type: Exclude<BuildSelection, null>,
  tileX: number,
  tileY: number,
) {
  if (getBuildingAtTile(tileX, tileY)) return false

  const tile = getTileAtWorldTile(tileX, tileY)

  if (type === 'burner_drill') {
    return !!tile.object && isMineableResource(tile.object.type)
  }

  if (type === 'wooden_chest') {
    return tile.object === null
  }

  return false
}

export function placeBurnerDrill(tileX: number, tileY: number, direction: Direction) {
  if (!canPlaceBuilding('burner_drill', tileX, tileY)) return false

  buildings.set(getKey(tileX, tileY), {
    type: 'burner_drill',
    tileX,
    tileY,
    direction,
    fuel: 0,
    progress: 0,
    outputItem: null,
    outputCount: 0,
    outputCapacity: 5,
  })

  return true
}

export function placeWoodenChest(tileX: number, tileY: number) {
  if (!canPlaceBuilding('wooden_chest', tileX, tileY)) return false

  buildings.set(getKey(tileX, tileY), {
    type: 'wooden_chest',
    tileX,
    tileY,
    item: null,
    count: 0,
    capacity: 50,
  })

  return true
}

export function removeBuildingAtTile(tileX: number, tileY: number) {
  const building = getBuildingAtTile(tileX, tileY)
  if (!building) return false

  if (building.type === 'wooden_chest' && building.item && building.count > 0) {
    addItem(building.item, building.count)
  }

  if (building.type === 'burner_drill' && building.outputItem && building.outputCount > 0) {
    addItem(building.outputItem, building.outputCount)
  }

  buildings.delete(getKey(building.tileX, building.tileY))
  return true
}

export function fuelBuildingAtTile(tileX: number, tileY: number) {
  const building = getBuildingAtTile(tileX, tileY)
  if (!building || building.type !== 'burner_drill') return false

  if (getItemCount('coal') > 0 && removeItem('coal', 1)) {
    building.fuel += 8
    return true
  }

  if (getItemCount('wood') > 0 && removeItem('wood', 1)) {
    building.fuel += 5
    return true
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

  if (!removeItem('coal', 1)) return false
  building.fuel += 8
  return true
}

export function updateBuildings(dt: number) {
  for (const building of buildings.values()) {
    if (building.type !== 'burner_drill') continue

    tryAutoFuelDrill(building)
    tryPushDrillOutput(building)

    const tile = getTileAtWorldTile(building.tileX, building.tileY)
    const resourceType = tile.object?.type

    if (building.fuel <= 0) continue
    if (!isMineableResource(resourceType)) continue
    if (!canAcceptDrillOutput(building, resourceType)) continue

    building.fuel = Math.max(0, building.fuel - dt)
    building.progress += dt * 0.35

    while (building.progress >= 1) {
      const currentTile = getTileAtWorldTile(building.tileX, building.tileY)
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
        building.progress = 0
        break
      }
    }

    tryPushDrillOutput(building)
  }
}

function drawDirectionMarker(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  direction: Direction,
  color = '#ffd54f',
) {
  ctx.fillStyle = color

  if (direction === 'up') ctx.fillRect(screenX + 12, screenY + 3, 8, 4)
  if (direction === 'right') ctx.fillRect(screenX + 25, screenY + 12, 4, 8)
  if (direction === 'down') ctx.fillRect(screenX + 12, screenY + 25, 8, 4)
  if (direction === 'left') ctx.fillRect(screenX + 3, screenY + 12, 4, 8)
}

function drawBurnerDrillSprite(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  drill: BurnerDrill,
  alpha = 1,
) {
  ctx.save()
  ctx.globalAlpha = alpha

  ctx.fillStyle = '#6b4a2d'
  ctx.fillRect(screenX + 3, screenY + 3, 26, 26)

  ctx.fillStyle = '#8c6239'
  ctx.fillRect(screenX + 6, screenY + 6, 20, 20)

  ctx.fillStyle = '#4f555d'
  ctx.fillRect(screenX + 10, screenY + 9, 12, 10)

  ctx.fillStyle = '#2c3138'
  ctx.fillRect(screenX + 12, screenY + 11, 8, 6)

  ctx.fillStyle = '#cc6b2c'
  ctx.fillRect(screenX + 22, screenY + 7, 4, 8)

  drawDirectionMarker(ctx, screenX, screenY, drill.direction)

  ctx.fillStyle = 'black'
  ctx.fillRect(screenX + 4, screenY + 26, 24, 4)

  const fuelRatio = Math.min(drill.fuel / 10, 1)
  ctx.fillStyle = fuelRatio > 0 ? '#ff9800' : '#555'
  ctx.fillRect(screenX + 4, screenY + 26, 24 * fuelRatio, 4)

  if (drill.outputCount > 0) {
    ctx.fillStyle = drill.outputItem === 'coal' ? '#1a1a1d' : '#c0c6cf'
    ctx.fillRect(screenX + 6, screenY + 20, 6, 4)
  }

  ctx.restore()
}

function drawChestSprite(
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

export function renderBuildings(ctx: CanvasRenderingContext2D) {
  for (const building of buildings.values()) {
    if (!isTileExplored(building.tileX, building.tileY)) continue

    const screen = worldToScreen(building.tileX * TILE_SIZE, building.tileY * TILE_SIZE)

    if (building.type === 'burner_drill') {
      drawBurnerDrillSprite(ctx, screen.x, screen.y, building)
    } else {
      drawChestSprite(ctx, screen.x, screen.y, building)
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
        outputCapacity: 5,
      },
      0.55,
    )
  } else {
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

  const outputText = building.outputItem
    ? `${building.outputItem} ${building.outputCount}/${building.outputCapacity}`
    : `empty 0/${building.outputCapacity}`

  return [
    `drill ${building.direction} fuel:${building.fuel.toFixed(1)}`,
    `out: ${outputText}`,
    'F fuel  E open  X deconstruct',
  ]
}