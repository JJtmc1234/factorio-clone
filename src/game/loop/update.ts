import { consumePressed, input } from '../input'
import { player, updatePlayer } from '../player'
import { mouse, consumeLeftPressed, consumeWheelDelta } from '../mouse'
import { getTileAtScreenPosition, updateVisibility } from '../world'
import { updateMining, resetMining } from '../mining'
import { closeInventoryUi, isInventoryUiOpen, toggleInventoryUi } from '../inventory'
import { adjustZoom, updateCamera } from '../camera'
import {
  canPlaceBuilding,
  dragPlaceBelt,
  getBuildingAtTile,
  placeBurnerDrill,
  placeBurnerInserter,
  placeIronChest,
  placeStoneFurnace,
  placeTransportBelt,
  placeWoodenChest,
  removeBuildingAtTile,
  takeOneFromBuilding,
  updateBuildings,
} from '../buildings'
import type { Direction } from '../buildings'
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
import { toggleAltMode } from '../altMode'

// Smart belt drag — when the player holds left-click while a belt is selected,
// we lay an L-shaped run from the press tile to the cursor tile each frame.
// R while dragging swaps which axis the L bends on (horizontal-then-vertical
// vs vertical-then-horizontal); JJ called this the "very fast belt turn".
let beltDrag: { ox: number; oy: number; axisFirst: 'h' | 'v' } | null = null

function layBeltLine(
  ox: number,
  oy: number,
  tx: number,
  ty: number,
  axisFirst: 'h' | 'v',
  fallbackDir: Direction,
) {
  const dx = tx - ox
  const dy = ty - oy

  if (dx === 0 && dy === 0) {
    dragPlaceBelt(ox, oy, fallbackDir)
    return
  }

  const horizDir: Direction = dx >= 0 ? 'right' : 'left'
  const vertDir: Direction = dy >= 0 ? 'down' : 'up'
  const stepX = Math.sign(dx) || 0
  const stepY = Math.sign(dy) || 0

  if (axisFirst === 'h') {
    // Horizontal leg: (ox, oy) → (tx, oy)
    let x = ox
    while (x !== tx) {
      dragPlaceBelt(x, oy, horizDir)
      x += stepX
    }
    if (dy !== 0) {
      // Corner tile turns onto the vertical axis; tile (tx, oy) faces vertDir.
      dragPlaceBelt(tx, oy, vertDir)
      let y = oy + stepY
      while (y !== ty) {
        dragPlaceBelt(tx, y, vertDir)
        y += stepY
      }
      dragPlaceBelt(tx, ty, vertDir)
    } else {
      dragPlaceBelt(tx, oy, horizDir)
    }
    return
  }

  // axisFirst === 'v'
  let y = oy
  while (y !== ty) {
    dragPlaceBelt(ox, y, vertDir)
    y += stepY
  }
  if (dx !== 0) {
    dragPlaceBelt(ox, ty, horizDir)
    let x = ox + stepX
    while (x !== tx) {
      dragPlaceBelt(x, ty, horizDir)
      x += stepX
    }
    dragPlaceBelt(tx, ty, horizDir)
  } else {
    dragPlaceBelt(ox, ty, vertDir)
  }
}

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
        } else {
          state.openedBuilding = null
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
    if (beltDrag) {
      // Belt drag in progress → R pivots the L-bend axis instead of rotating
      // the cursor.
      beltDrag.axisFirst = beltDrag.axisFirst === 'h' ? 'v' : 'h'
    } else if (state.selectedBuild) {
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

  // ALT toggles the icon-overlay mode (Factorio's alt-mode).
  if (consumePressed('alt')) {
    toggleAltMode()
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
      // Replace-on-rotate: clicking with the same building type already on
      // the target tile re-orients it in place without consuming from
      // inventory or deconstructing — Factorio's "fast replace" baseline.
      const existing = getBuildingAtTile(hovered.tileX, hovered.tileY)
      if (existing && existing.type === state.selectedBuild) {
        if ('direction' in existing && existing.direction !== state.buildDirection) {
          existing.direction = state.buildDirection
        }
        // Same-type click consumed; skip the normal placement path.
      } else {
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

      // Latch the drag origin at the press tile so subsequent frames lay
      // an L-line from here. Default L-bend axis matches the cursor build
      // direction (horizontal first if the cursor faces left/right).
      if (state.selectedBuild === 'transport_belt' && hovered) {
        const initialAxis: 'h' | 'v' =
          state.buildDirection === 'left' || state.buildDirection === 'right' ? 'h' : 'v'
        beltDrag = { ox: hovered.tileX, oy: hovered.tileY, axisFirst: initialAxis }
      }
    } else if (!state.selectedBuild) {
      if (hoveredBuilding) {
        const wasSame = state.openedBuilding === hoveredBuilding
        state.openedBuilding = wasSame ? null : hoveredBuilding
        // Opening an entity also opens the inventory so the player can
        // transfer items between the two panels (Factorio convention).
        if (state.openedBuilding && !isInventoryUiOpen()) toggleInventoryUi()
      } else {
        state.openedBuilding = null
      }
    }
  }

  // Belt drag continuation — runs every frame while the player holds the
  // mouse with a belt selected and an in-bounds cursor. layBeltLine is
  // idempotent for tiles that already match, so calling it each frame is
  // free until the cursor actually moves.
  if (
    beltDrag &&
    mouse.leftDown &&
    state.selectedBuild === 'transport_belt' &&
    hovered
  ) {
    layBeltLine(
      beltDrag.ox,
      beltDrag.oy,
      hovered.tileX,
      hovered.tileY,
      beltDrag.axisFirst,
      state.buildDirection,
    )
  } else if (!mouse.leftDown && beltDrag) {
    beltDrag = null
  }

  // F: pick the front item off the belt under the cursor (JJ binding).
  if (consumePressed('f') && hoveredBuilding?.type === 'transport_belt') {
    takeOneFromBuilding(hoveredBuilding)
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
