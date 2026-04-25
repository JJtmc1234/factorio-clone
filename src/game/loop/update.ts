import { consumePressed, input } from '../input'
import { player, updatePlayer } from '../player'
import { mouse, consumeRightPressed } from '../mouse'
import { getTileAtScreenPosition, updateVisibility } from '../world'
import { updateMining, resetMining } from '../mining'
import { isInventoryUiOpen, toggleInventoryUi } from '../inventory'
import { updateCamera } from '../camera'
import {
  canPlaceBuilding,
  fuelBuildingAtTile,
  getBuildingAtTile,
  placeBurnerDrill,
  placeBurnerInserter,
  placeStoneFurnace,
  placeTransportBelt,
  placeWoodenChest,
  removeBuildingAtTile,
  storeOneCoalInBuilding,
  takeOneFromBuilding,
  updateBuildings,
} from '../buildings'
import { mapState, toggleMap } from '../map'
import { rotateDirection, state } from './state'

export function update(dt: number, canvas: HTMLCanvasElement) {
  if (consumePressed('tab') || consumePressed('i')) {
    toggleInventoryUi()
    if (isInventoryUiOpen()) state.openedBuilding = null
    resetMining()
  }

  if (consumePressed('m') && !isInventoryUiOpen()) {
    toggleMap()
  }

  if (consumePressed('escape')) {
    state.selectedBuild = null
    state.openedBuilding = null
    resetMining()
  }

  if (mapState.open || isInventoryUiOpen()) return

  if (consumePressed('1')) state.selectedBuild = 'burner_drill'
  if (consumePressed('2')) state.selectedBuild = 'wooden_chest'
  if (consumePressed('3')) state.selectedBuild = 'transport_belt'
  if (consumePressed('4')) state.selectedBuild = 'stone_furnace'
  if (consumePressed('5')) state.selectedBuild = 'burner_inserter'

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

  if (consumePressed('e')) {
    if (state.openedBuilding && hoveredBuilding === state.openedBuilding) {
      state.openedBuilding = null
    } else {
      state.openedBuilding = hoveredBuilding
      state.selectedBuild = null
    }
    resetMining()
  }

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
