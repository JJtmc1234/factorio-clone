import { mouse } from './mouse'
import { getTileAtScreenPosition } from './world'
import { addItem } from './inventory'

let miningTileX: number | null = null
let miningTileY: number | null = null
let miningProgress = 0

export function updateMining(dt: number) {
  const hovered = getTileAtScreenPosition(mouse.x, mouse.y)

  if (!mouse.leftDown || !hovered || !hovered.tile.object) {
    resetMining()
    return
  }

  if (hovered.tileX !== miningTileX || hovered.tileY !== miningTileY) {
    miningTileX = hovered.tileX
    miningTileY = hovered.tileY
    miningProgress = 0
  }

  const obj = hovered.tile.object
  const miningSpeed = obj.type === 'tree' ? 2.5 : 1.2

  miningProgress += dt * miningSpeed

  if (miningProgress >= 1) {
    if (obj.type === 'tree') {
      addItem('wood', 1)
    }

    if (obj.type === 'ore') {
      addItem('iron_ore', 1)
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

function resetMining() {
  miningTileX = null
  miningTileY = null
  miningProgress = 0
}