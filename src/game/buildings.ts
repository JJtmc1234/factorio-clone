import { worldToScreen } from './camera'
import { getGameSprite } from '../components/gameSprites.ts'
import { addItem, getItemCount, removeItem } from './inventory'
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

const buildings: Building[] = []

function isMineableResource(type: string | undefined): type is ItemType {
  return type === 'iron_ore' || type === 'coal'
}

function occupiesTile(building: Building, tileX: number, tileY: number) {
  if (building.type === 'wooden_chest') {
    return building.tileX === tileX && building.tileY === tileY
  }

  return (
    tileX >= building.tileX &&
    tileX < building.tileX + 2 &&
    tileY >= building.tileY &&
    tileY < building.tileY + 2
  )
}

function getDrillCoveredTiles(drill: BurnerDrill) {
  return [
    { x: drill.tileX, y: drill.tileY },
    { x: drill.tileX + 1, y: drill.tileY },
    { x: drill.tileX, y: drill.tileY + 1 },
    { x: drill.tileX + 1, y: drill.tileY + 1 },
  ]
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

  if (target.type === 'burner_drill' && drill.outputItem === 'coal' && target.fuel <= 5) {
    drill.outputCount -= 1
    if (drill.outputCount <= 0) {
      drill.outputCount = 0
      drill.outputItem = null
    }
    target.fuel += 8
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
  if (type === 'wooden_chest') {
    if (getBuildingAtTile(tileX, tileY)) return false
    const tile = getTileAtWorldTile(tileX, tileY)
    return tile.object === null
  }

  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      const x = tileX + dx
      const y = tileY + dy

      if (getBuildingAtTile(x, y)) return false
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

  buildings.splice(index, 1)
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

    if (!isTileExplored(building.tileX, building.tileY)) continue

    const screen = worldToScreen(building.tileX * TILE_SIZE, building.tileY * TILE_SIZE)
    drawChestSprite(ctx, screen.x, screen.y, building)

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
    `2x2 drill ${building.direction} fuel:${building.fuel.toFixed(1)}`,
    `out: ${outputText}`,
    'F fuel  E open  X deconstruct',
  ]
}