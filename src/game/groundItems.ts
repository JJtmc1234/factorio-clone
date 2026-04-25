import { TILE_SIZE } from './world'
import { worldToScreen } from './camera'

export interface GroundItem {
  id: number
  item: string
  tileX: number
  tileY: number
  count: number
}

const groundItems = new Map<number, GroundItem>()
let nextGroundItemId = 1

export function getAllGroundItems() {
  return [...groundItems.values()]
}

export function getGroundItemsAtTile(tileX: number, tileY: number) {
  return getAllGroundItems().filter((item) => item.tileX === tileX && item.tileY === tileY)
}

export function spawnGroundItem(tileX: number, tileY: number, item: string, count = 1) {
  if (count <= 0) return

  const existing = getAllGroundItems().find(
    (groundItem) =>
      groundItem.tileX === tileX &&
      groundItem.tileY === tileY &&
      groundItem.item === item,
  )

  if (existing) {
    existing.count += count
    return
  }

  groundItems.set(nextGroundItemId, {
    id: nextGroundItemId,
    item,
    tileX,
    tileY,
    count,
  })

  nextGroundItemId += 1
}

export function removeGroundItem(id: number) {
  groundItems.delete(id)
}

export function removeOneGroundItemAtTile(tileX: number, tileY: number, item: string) {
  const groundItem = getAllGroundItems().find(
    (entry) => entry.tileX === tileX && entry.tileY === tileY && entry.item === item,
  )

  if (!groundItem) return false

  groundItem.count -= 1
  if (groundItem.count <= 0) {
    groundItems.delete(groundItem.id)
  }

  return true
}

export function pickupGroundItemsAtTile(
  tileX: number,
  tileY: number,
  addItem: (item: string, count?: number) => void,
) {
  const items = getGroundItemsAtTile(tileX, tileY)

  for (const item of items) {
    addItem(item.item, item.count)
    groundItems.delete(item.id)
  }
}

function getGroundItemColor(item: string) {
  if (item === 'coal') return '#1a1a1d'
  if (item === 'iron_ore') return '#c0c6cf'
  if (item === 'copper_ore') return '#b87333'
  if (item === 'stone') return '#8f8f8f'
  if (item === 'wood') return '#8d6e63'
  if (item === 'iron_plate') return '#d9dee6'
  if (item === 'copper_plate') return '#d08a45'
  if (item === 'stone_brick') return '#b0b0b0'
  return '#ffffff'
}

export function renderGroundItems(ctx: CanvasRenderingContext2D) {
  for (const item of groundItems.values()) {
    const screen = worldToScreen(item.tileX * TILE_SIZE, item.tileY * TILE_SIZE)

    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
    ctx.beginPath()
    ctx.ellipse(screen.x + 16, screen.y + 24, 10, 4, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = getGroundItemColor(item.item)
    ctx.fillRect(screen.x + 10, screen.y + 14, 12, 8)

    ctx.fillStyle = '#111'
    ctx.font = '10px sans-serif'
    ctx.fillText(String(item.count), screen.x + 18, screen.y + 11)
  }
}