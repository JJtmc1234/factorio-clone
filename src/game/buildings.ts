import { worldToScreen } from './camera'
import { getItemCount, removeItem } from './inventory'
import { TILE_SIZE, getTileAtWorldTile, isTileExplored, isTileVisible } from './world'

export type Direction = 'up' | 'right' | 'down' | 'left'
export type BuildingType = 'burner_drill' | 'wooden_chest'
export type BuildSelection = BuildingType | null
export type ItemType = 'iron_ore' | 'coal'

export interface BurnerDrill {
  type: 'burner_drill'
  tileX: number
  tileY: number
  width: 2
  height: 2
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
const occupiedTiles = new Map<string, Building>()

function getKey(tileX: number, tileY: number) {
  return `${tileX},${tileY}`
}

function getDrillFootprint(tileX: number, tileY: number) {
  return [
    { x: tileX, y: tileY },
    { x: tileX + 1, y: tileY },
    { x: tileX, y: tileY + 1 },
    { x: tileX + 1, y: tileY + 1 },
  ]
}

function getDrillOutputTile(drill: Pick<BurnerDrill, 'tileX' | 'tileY' | 'direction'>) {
  if (drill.direction === 'up') return { x: drill.tileX, y: drill.tileY - 1 }
  if (drill.direction === 'right') return { x: drill.tileX + 2, y: drill.tileY }
  if (drill.direction === 'down') return { x: drill.tileX + 1, y: drill.tileY + 2 }
  return { x: drill.tileX - 1, y: drill.tileY + 1 }
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

function getDrillResourceTile(drill: BurnerDrill) {
  const footprint = getDrillFootprint(drill.tileX, drill.tileY)

  let best: { x: number; y: number; type: ItemType; amount: number } | null = null

  for (const pos of footprint) {
    const tile = getTileAtWorldTile(pos.x, pos.y)
    const resourceType = tile.object?.type

    if (!isMineableResource(resourceType) || !tile.object) continue

    if (!best || tile.object.amount > best.amount) {
      best = {
        x: pos.x,
        y: pos.y,
        type: resourceType,
        amount: tile.object.amount,
      }
    }
  }

  return best
}

function tryAutoFuelDrill(drill: BurnerDrill) {
  if (drill.fuel > 2) return

  const outputTile = getDrillOutputTile(drill)
  const target = getBuildingAtTile(outputTile.x, outputTile.y)

  if (!target || target === drill) return

  if (target.type === 'wooden_chest' && consumeCoalFromChest(target)) {
    drill.fuel += 8
    return
  }

  if (target.type === 'burner_drill' && consumeCoalFromDrill(target)) {
    drill.fuel += 8
  }
}

function tryPushDrillOutput(drill: BurnerDrill) {
  if (!drill.outputItem || drill.outputCount <= 0) return

  const outputTile = getDrillOutputTile(drill)
  const target = getBuildingAtTile(outputTile.x, outputTile.y)

  if (!target || target === drill) return

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

  if (target.type === 'burner_drill' && drill.outputItem === 'coal' && target.fuel <= 6) {
    drill.outputCount -= 1
    if (drill.outputCount <= 0) {
      drill.outputCount = 0
      drill.outputItem = null
    }
    target.fuel += 8
  }
}

export function getBuildingAtTile(tileX: number, tileY: number) {
  return occupiedTiles.get(getKey(tileX, tileY)) ?? null
}

export function canPlaceBuilding(
  type: Exclude<BuildSelection, null>,
  tileX: number,
  tileY: number,
) {
  if (type === 'burner_drill') {
    const footprint = getDrillFootprint(tileX, tileY)
    let hasResource = false

    for (const pos of footprint) {
      if (getBuildingAtTile(pos.x, pos.y)) return false

      const tile = getTileAtWorldTile(pos.x, pos.y)
      const objectType = tile.object?.type

      if (objectType === 'tree') return false
      if (isMineableResource(objectType)) hasResource = true
    }

    return hasResource
  }

  if (type === 'wooden_chest') {
    if (getBuildingAtTile(tileX, tileY)) return false
    const tile = getTileAtWorldTile(tileX, tileY)
    return tile.object === null
  }

  return false
}

export function placeBurnerDrill(tileX: number, tileY: number, direction: Direction) {
  if (!canPlaceBuilding('burner_drill', tileX, tileY)) return false

  const drill: BurnerDrill = {
    type: 'burner_drill',
    tileX,
    tileY,
    width: 2,
    height: 2,
    direction,
    fuel: 0,
    progress: 0,
    outputItem: null,
    outputCount: 0,
    outputCapacity: 8,
  }

  buildings.set(getKey(tileX, tileY), drill)

  for (const pos of getDrillFootprint(tileX, tileY)) {
    occupiedTiles.set(getKey(pos.x, pos.y), drill)
  }

  return true
}

export function placeWoodenChest(tileX: number, tileY: number) {
  if (!canPlaceBuilding('wooden_chest', tileX, tileY)) return false

  const chest: WoodenChest = {
    type: 'wooden_chest',
    tileX,
    tileY,
    item: null,
    count: 0,
    capacity: 50,
  }

  buildings.set(getKey(tileX, tileY), chest)
  occupiedTiles.set(getKey(tileX, tileY), chest)
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
    building.fuel += 4
    return true
  }

  return false
}

export function updateBuildings(dt: number) {
  for (const building of buildings.values()) {
    if (building.type !== 'burner_drill') continue

    tryAutoFuelDrill(building)
    tryPushDrillOutput(building)

    const resourceTile = getDrillResourceTile(building)
    if (!resourceTile) {
      building.progress = 0
      continue
    }

    if (building.fuel <= 0) continue
    if (!canAcceptDrillOutput(building, resourceTile.type)) continue

    building.fuel = Math.max(0, building.fuel - dt)
    building.progress += dt * 0.5

    while (building.progress >= 1) {
      const current = getDrillResourceTile(building)

      if (!current) {
        building.progress = 0
        break
      }

      if (!addDrillOutput(building, current.type)) {
        building.progress = 0.999
        break
      }

      const tile = getTileAtWorldTile(current.x, current.y)
      const obj = tile.object
      if (!obj || !isMineableResource(obj.type)) {
        building.progress = 0
        break
      }

      obj.amount -= 1
      building.progress -= 1

      if (obj.amount <= 0) {
        tile.object = null
      }

      tryPushDrillOutput(building)
    }
  }
}

function drawDirectionMarker(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  width: number,
  height: number,
  direction: Direction,
  color = '#ffd54f',
) {
  ctx.fillStyle = color

  const midX = Math.floor(width / 2)
  const midY = Math.floor(height / 2)

  if (direction === 'up') ctx.fillRect(screenX + midX - 6, screenY + 4, 12, 6)
  if (direction === 'right') ctx.fillRect(screenX + width - 10, screenY + midY - 6, 6, 12)
  if (direction === 'down') ctx.fillRect(screenX + midX - 6, screenY + height - 10, 12, 6)
  if (direction === 'left') ctx.fillRect(screenX + 4, screenY + midY - 6, 6, 12)
}

function drawBurnerDrillSprite(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  drill: BurnerDrill,
  alpha = 1,
) {
  const width = drill.width * TILE_SIZE
  const height = drill.height * TILE_SIZE

  ctx.save()
  ctx.globalAlpha = alpha

  ctx.fillStyle = '#5b3c20'
  ctx.fillRect(screenX + 4, screenY + 4, width - 8, height - 8)

  ctx.fillStyle = '#7a5230'
  ctx.fillRect(screenX + 8, screenY + 8, width - 16, height - 16)

  ctx.fillStyle = '#3b4048'
  ctx.fillRect(screenX + 18, screenY + 14, width - 36, height - 28)

  ctx.fillStyle = '#262a30'
  ctx.fillRect(screenX + 24, screenY + 20, width - 48, height - 40)

  ctx.fillStyle = '#c96a2c'
  ctx.fillRect(screenX + width - 18, screenY + 12, 8, 16)

  drawDirectionMarker(ctx, screenX, screenY, width, height, drill.direction)

  ctx.strokeStyle = '#1e1e1e'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(screenX + width / 2, screenY + 14)
  ctx.lineTo(screenX + width / 2, screenY + height - 14)
  ctx.moveTo(screenX + 14, screenY + height / 2)
  ctx.lineTo(screenX + width - 14, screenY + height / 2)
  ctx.stroke()

  ctx.fillStyle = 'black'
  ctx.fillRect(screenX + 8, screenY + height - 10, width - 16, 5)

  const fuelRatio = Math.min(drill.fuel / 16, 1)
  ctx.fillStyle = fuelRatio > 0 ? '#ff9800' : '#555'
  ctx.fillRect(screenX + 8, screenY + height - 10, (width - 16) * fuelRatio, 5)

  if (drill.outputCount > 0) {
    ctx.fillStyle = drill.outputItem === 'coal' ? '#1a1a1d' : '#c0c6cf'
    ctx.fillRect(screenX + 10, screenY + height - 22, 12, 8)
    ctx.fillRect(screenX + 24, screenY + height - 22, 8, 8)
  }

  const outputTile = getDrillOutputTile(drill)
  const outputScreen = worldToScreen(outputTile.x * TILE_SIZE, outputTile.y * TILE_SIZE)
  ctx.strokeStyle = '#00e5ff'
  ctx.lineWidth = 2
  ctx.strokeRect(outputScreen.x + 6, outputScreen.y + 6, TILE_SIZE - 12, TILE_SIZE - 12)

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
  const drawn = new Set<Building>()

  for (const building of occupiedTiles.values()) {
    if (drawn.has(building)) continue
    drawn.add(building)

    if (!isTileExplored(building.tileX, building.tileY)) continue

    const screen = worldToScreen(building.tileX * TILE_SIZE, building.tileY * TILE_SIZE)

    if (building.type === 'burner_drill') {
      drawBurnerDrillSprite(ctx, screen.x, screen.y, building)

      if (!isTileVisible(building.tileX, building.tileY)) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
        ctx.fillRect(screen.x, screen.y, building.width * TILE_SIZE, building.height * TILE_SIZE)
      }
    } else {
      drawChestSprite(ctx, screen.x, screen.y, building)

      if (!isTileVisible(building.tileX, building.tileY)) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
        ctx.fillRect(screen.x, screen.y, TILE_SIZE, TILE_SIZE)
      }
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
        width: 2,
        height: 2,
        direction,
        fuel: 8,
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

  ctx.strokeStyle = valid ? '#00e5ff' : '#ff5252'
  ctx.lineWidth = 2
  ctx.strokeRect(screen.x + 1, screen.y + 1, TILE_SIZE - 2, TILE_SIZE - 2)
}

export function getPrimaryBuildingTile(building: Building) {
  return { x: building.tileX, y: building.tileY }
}

export function getBuildingTooltipLines(building: Building) {
  if (building.type === 'wooden_chest') {
    const itemText = building.item ?? 'empty'
    return ['wooden chest', `${itemText}: ${building.count}/${building.capacity}`]
  }

  const outputTile = getDrillOutputTile(building)
  const outputText = building.outputItem
    ? `${building.outputItem} ${building.outputCount}/${building.outputCapacity}`
    : `empty 0/${building.outputCapacity}`

  return [
    `2x2 drill ${building.direction} fuel:${building.fuel.toFixed(1)}`,
    `out: ${outputText} -> ${outputTile.x},${outputTile.y}`,
  ]
}