import { mouse } from './mouse'
import { input } from './input'
import { getTileAtScreenPosition } from './world'
import { addItem } from './inventory'
import { getBuildingAtTile } from './buildings'

let miningTileX: number | null = null
let miningTileY: number | null = null
let miningProgress = 0

// The Windows ContextMenu key (and macOS-equivalent) drives mining now —
// left-click is reserved for placement / opening entities.
function isMiningKeyHeld() {
  return !!input.keys['contextmenu']
}

export function updateMining(dt: number) {
  const hovered = getTileAtScreenPosition(mouse.x, mouse.y)

  if (
    !isMiningKeyHeld() ||
    !hovered ||
    !hovered.tile.object ||
    getBuildingAtTile(hovered.tileX, hovered.tileY)
  ) {
    resetMining()
    return
  }

  if (hovered.tileX !== miningTileX || hovered.tileY !== miningTileY) {
    miningTileX = hovered.tileX
    miningTileY = hovered.tileY
    miningProgress = 0
  }

  const obj = hovered.tile.object
  const miningSpeed =
    obj.type === 'tree'
      ? 2.5
      : obj.type === 'coal'
        ? 1.5
        : obj.type === 'stone'
          ? 0.9
          : 1.2

  miningProgress += dt * miningSpeed

  if (miningProgress >= 1) {
    if (obj.type === 'tree') {
      addItem('wood', 1)
    } else if (obj.type === 'iron_ore') {
      addItem('iron_ore', 1)
    } else if (obj.type === 'copper_ore') {
      addItem('copper_ore', 1)
    } else if (obj.type === 'stone') {
      addItem('stone', 1)
    } else if (obj.type === 'coal') {
      addItem('coal', 1)
    }

    obj.amount -= 1
    miningProgress = 0

    if (obj.amount <= 0) {
      hovered.tile.object = null
      resetMining()
    }
  }
}

export function getMiningProgress() {
  return miningProgress
}

export function getMiningTarget() {
  if (miningTileX === null || miningTileY === null) return null
  return { tileX: miningTileX, tileY: miningTileY }
}

export function resetMining() {
  miningTileX = null
  miningTileY = null
  miningProgress = 0
}