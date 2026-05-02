import { consumePressed, input } from '../input'
import { player, updatePlayer } from '../player'
import { mouse, consumeLeftPressed, consumeRightPressed } from '../mouse'
import { getTileAtScreenPosition, updateVisibility } from '../world'
import { updateMining, resetMining } from '../mining'
import { closeInventoryUi, isInventoryUiOpen, toggleInventoryUi } from '../inventory'
import { updateCamera } from '../camera'
import {
  canPlaceBuilding,
  fuelBuildingAtTile,
  getBuildingAtTile,
  placeBurnerDrill,
  placeBurnerInserter,
  placeIronChest,
  placeStoneFurnace,
  placeTransportBelt,
  placeWoodenChest,
  removeBuildingAtTile,
  storeOneCoalInBuilding,
  takeOneFromBuilding,
  updateBuildings,
} from '../buildings'
import { mapState, toggleMap } from '../map'
import { updateCrafting } from '../crafting'
import { handleInventoryMenuClick } from './hud'
import { rotateDirection, state } from './state'

export function update(dt: number, canvas: HTMLCanvasElement) {
  // Crafting ticks regardless of menu state — recipes finish even with the inventory closed.
  updateCrafting(dt)

  const hoveredForOpen = getTileAtScreenPosition(mouse.x, mouse.y)
  const hoveredBuildingForOpen = hoveredForOpen
    ? getBuildingAtTile(hoveredForOpen.tileX, hoveredForOpen.tileY)
    : null

  // E is the primary inventory toggle. Tab/I are aliases. Opening while
  // hovering a building also opens that building's panel (Factorio-style).
  const inventoryToggle =
    consumePressed('e') || consumePressed('tab') || consumePressed('i')

  if (inventoryToggle) {
    if (isInventoryUiOpen()) {
      closeInventoryUi()
      state.openedBuilding = null
    } else {
      toggleInventoryUi()
      state.openedBuilding = hoveredBuildingForOpen
      state.selectedBuild = null
    }
    resetMining()
  }

  if (consumePressed('m') && !isInventoryUiOpen()) {
    toggleMap()
  }

  if (consumePressed('escape')) {
    if (isInventoryUiOpen()) closeInventoryUi()
    state.selectedBuild = null
    state.openedBuilding = null
    resetMining()
  }

  if (isInventoryUiOpen()) {
    if (consumeLeftPressed()) {
      handleInventoryMenuClick(canvas, mouse.x, mouse.y)
    }
    return
  }

  if (mapState.open) return

  if (consumePressed('1')) state.selectedBuild = 'burner_drill'
  if (consumePressed('2')) state.selectedBuild = 'wooden_chest'
  if (consumePressed('3')) state.selectedBuild = 'transport_belt'
  if (consumePressed('4')) state.selectedBuild = 'stone_furnace'
  if (consumePressed('5')) state.selectedBuild = 'burner_inserter'
  if (consumePressed('6')) state.selectedBuild = 'iron_chest'

  if (consumePressed('r')) {
    state.buildDirection = rotateDirection(state.buildDirection)
  }

  updatePlayer(dt, input.keys)

  updateCamera(
    player.x + player.size / 2,
    player.y + player.size / 2,
    canvas.width,
    canvas.height,
  )

  updateVisibility(player.x + player.size / 2, player.y + player.size / 2, 10)

  const hovered = getTileAtScreenPosition(mouse.x, mouse.y)
  const hoveredBuilding = hovered ? getBuildingAtTile(hovered.tileX, hovered.tileY) : null

  if (consumePressed('x') && hoveredBuilding) {
    if (state.openedBuilding === hoveredBuilding) {
      state.openedBuilding = null
    }
    removeBuildingAtTile(hoveredBuilding.tileX, hoveredBuilding.tileY)
    resetMining()
  }

  if (consumeRightPressed() && hovered && state.selectedBuild) {
    const valid = canPlaceBuilding(state.selectedBuild, hovered.tileX, hovered.tileY)

    if (valid) {
      if (state.selectedBuild === 'burner_drill') {
        placeBurnerDrill(hovered.tileX, hovered.tileY, state.buildDirection)
      } else if (state.selectedBuild === 'wooden_chest') {
        placeWoodenChest(hovered.tileX, hovered.tileY)
      } else if (state.selectedBuild === 'transport_belt') {
        placeTransportBelt(hovered.tileX, hovered.tileY, state.buildDirection)
      } else if (state.selectedBuild === 'stone_furnace') {
        placeStoneFurnace(hovered.tileX, hovered.tileY)
      } else if (state.selectedBuild === 'burner_inserter') {
        placeBurnerInserter(hovered.tileX, hovered.tileY, state.buildDirection)
      } else if (state.selectedBuild === 'iron_chest') {
        placeIronChest(hovered.tileX, hovered.tileY)
      }
    }
  }

  if (consumePressed('f') && hovered) {
    const fueled = fuelBuildingAtTile(hovered.tileX, hovered.tileY)
    if (!fueled && state.openedBuilding) {
      storeOneCoalInBuilding(state.openedBuilding)
    }
  }

  if (state.openedBuilding && consumePressed('g')) {
    takeOneFromBuilding(state.openedBuilding)
  }

  updateBuildings(dt)

  if (!state.openedBuilding && !state.selectedBuild) {
    updateMining(dt)
  } else {
    resetMining()
  }
}
