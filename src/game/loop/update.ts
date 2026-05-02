import { consumePressed, input } from '../input'
import { player, updatePlayer } from '../player'
import { mouse, consumeLeftPressed, consumeWheelDelta } from '../mouse'
import { getTileAtScreenPosition, updateVisibility } from '../world'
import { updateMining, resetMining } from '../mining'
import { closeInventoryUi, isInventoryUiOpen, toggleInventoryUi } from '../inventory'
import { adjustZoom, updateCamera } from '../camera'
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
import {
  grantDebugItems,
  handleInventoryMenuClick,
  isDebugButtonHit,
  isOverRecipeArea,
  scrollRecipeList,
} from './hud'
import { rotateDirection, state } from './state'

export function update(dt: number, canvas: HTMLCanvasElement) {
  // Crafting ticks regardless of menu state — recipes finish even with the inventory closed.
  updateCrafting(dt)

  // Debug button is checked before any other click handler so it works
  // regardless of menu state. Peek at the press without consuming so the
  // rest of the loop runs normally when the button isn't hit.
  if (mouse.leftPressed && isDebugButtonHit(canvas, mouse.x, mouse.y)) {
    consumeLeftPressed()
    grantDebugItems()
    return
  }

  // Wheel handling, single source of truth so deltas don't accumulate
  // between frames. Inventory recipe list wins when open + over the area;
  // otherwise the wheel zooms the world view.
  const wheel = consumeWheelDelta()
  if (wheel !== 0) {
    if (isInventoryUiOpen() && isOverRecipeArea(canvas, mouse.x, mouse.y)) {
      scrollRecipeList(wheel)
    } else {
      adjustZoom(wheel)
    }
  }

  // E (Tab/I aliases) toggles the inventory only. Entity panels open by
  // clicking the entity itself — see the left-click handler below.
  const inventoryToggle =
    consumePressed('e') || consumePressed('tab') || consumePressed('i')

  if (inventoryToggle) {
    if (isInventoryUiOpen()) {
      closeInventoryUi()
    } else {
      toggleInventoryUi()
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
      const hit = handleInventoryMenuClick(canvas, mouse.x, mouse.y)
      if (!hit) {
        // Click missed every inventory hit-rect — pass it through to the
        // world so the player can still click entities (open/close their
        // panel) with the inventory open, like vanilla.
        const tile = getTileAtScreenPosition(mouse.x, mouse.y)
        const b = tile ? getBuildingAtTile(tile.tileX, tile.tileY) : null
        if (b) {
          state.openedBuilding = state.openedBuilding === b ? null : b
        }
      }
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
    if (state.selectedBuild) {
      // Rotating the cursor build — affects the next placement.
      state.buildDirection = rotateDirection(state.buildDirection)
    } else {
      // R on a hovered placed building rotates it in place (Factorio-style).
      const tile = getTileAtScreenPosition(mouse.x, mouse.y)
      const b = tile ? getBuildingAtTile(tile.tileX, tile.tileY) : null
      if (b && 'direction' in b) {
        b.direction = rotateDirection(b.direction)
      }
    }
  }

  // Q pipettes: with a build selected, clear it; otherwise pick up the
  // hovered building's type as the cursor (Factorio default).
  if (consumePressed('q')) {
    if (state.selectedBuild) {
      state.selectedBuild = null
    } else {
      const tile = getTileAtScreenPosition(mouse.x, mouse.y)
      const b = tile ? getBuildingAtTile(tile.tileX, tile.tileY) : null
      if (b) state.selectedBuild = b.type
    }
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

  // Left-click is multi-purpose, gated on selectedBuild:
  //   - With a build selected → place (consumes one from inventory).
  //   - Without → open/close the entity panel under cursor.
  // Mining is a separate keyboard binding (Menu/ContextMenu key) so it
  // doesn't compete with this click.
  if (consumeLeftPressed()) {
    if (state.selectedBuild && hovered) {
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
    } else if (!state.selectedBuild) {
      if (hoveredBuilding) {
        state.openedBuilding =
          state.openedBuilding === hoveredBuilding ? null : hoveredBuilding
      } else {
        state.openedBuilding = null
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

  // Mining is now keyboard-driven (ContextMenu key); only block it when
  // the player is in build-mode (about to place) since the cursor is busy.
  if (!state.selectedBuild) {
    updateMining(dt)
  } else {
    resetMining()
  }
}
