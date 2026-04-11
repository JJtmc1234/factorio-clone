import { loadGameSprites, getGameSprite } from '../components/gameSprites'
import { setupInput, input, consumePressed } from './input'
import { player, updatePlayer } from './player'
import { setupMouse, mouse, consumeRightPressed } from './mouse'
import {
  TILE_SIZE,
  getTileAtWorldTile,
  getTileAtScreenPosition,
  getVisibleTileBounds,
  isTileExplored,
  isTileVisible,
  updateVisibility,
} from './world'
import { updateMining, getMiningProgress, getMiningTarget, resetMining } from './mining'
import { inventory, isInventoryUiOpen, toggleInventoryUi } from './inventory'
import { updateCamera, worldToScreen } from './camera'
import {
  type Direction,
  type BuildSelection,
  type Building,
  canPlaceBuilding,
  fuelBuildingAtTile,
  getBuildingAtTile,
  getBuildingTooltipLines,
  placeBurnerDrill,
  placeBurnerInserter,
  placeStoneFurnace,
  placeTransportBelt,
  placeWoodenChest,
  removeBuildingAtTile,
  renderBuildingGhost,
  renderBuildings,
  storeOneCoalInBuilding,
  takeOneFromBuilding,
  updateBuildings,
} from './buildings'
import { mapState, renderMap, toggleMap } from './map'

let running = false

function rotateDirection(direction: Direction): Direction {
  if (direction === 'down') return 'left'
  if (direction === 'left') return 'up'
  if (direction === 'up') return 'right'
  return 'down'
}

export function startGame(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  if (running) return
  running = true

  loadGameSprites()
  setupInput()
  setupMouse(canvas)

  let selectedBuild: BuildSelection = null
  let buildDirection: Direction = 'down'
  let openedBuilding: Building | null = null
  let last = performance.now()

  function loop(now: number) {
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now

    update(dt)
    render()

    requestAnimationFrame(loop)
  }

  function update(dt: number) {
    if (consumePressed('tab') || consumePressed('i')) {
      toggleInventoryUi()
      if (isInventoryUiOpen()) {
        openedBuilding = null
      }
      resetMining()
    }

    if (consumePressed('m') && !isInventoryUiOpen()) {
      toggleMap()
    }

    if (consumePressed('escape')) {
      selectedBuild = null
      openedBuilding = null
      resetMining()
    }

    if (mapState.open || isInventoryUiOpen()) {
      return
    }

    if (consumePressed('1')) {
      selectedBuild = 'burner_drill'
      openedBuilding = null
    }

    if (consumePressed('2')) {
      selectedBuild = 'wooden_chest'
      openedBuilding = null
    }

    if (consumePressed('3')) {
      selectedBuild = 'transport_belt'
      openedBuilding = null
    }

    if (consumePressed('4')) {
      selectedBuild = 'stone_furnace'
      openedBuilding = null
    }

    if (consumePressed('5')) {
      selectedBuild = 'burner_inserter'
      openedBuilding = null
    }

    if (consumePressed('r')) {
      buildDirection = rotateDirection(buildDirection)
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
      if (openedBuilding && hoveredBuilding === openedBuilding) {
        openedBuilding = null
      } else {
        openedBuilding = hoveredBuilding
        selectedBuild = null
      }
      resetMining()
    }

    if (consumePressed('x') && hoveredBuilding) {
      if (openedBuilding === hoveredBuilding) {
        openedBuilding = null
      }
      removeBuildingAtTile(hoveredBuilding.tileX, hoveredBuilding.tileY)
      resetMining()
    }

    if (consumeRightPressed() && hovered && selectedBuild) {
      const valid = canPlaceBuilding(selectedBuild, hovered.tileX, hovered.tileY)

      if (valid) {
        if (selectedBuild === 'burner_drill') {
          placeBurnerDrill(hovered.tileX, hovered.tileY, buildDirection)
        } else if (selectedBuild === 'wooden_chest') {
          placeWoodenChest(hovered.tileX, hovered.tileY)
        } else if (selectedBuild === 'transport_belt') {
          placeTransportBelt(hovered.tileX, hovered.tileY, buildDirection)
        } else if (selectedBuild === 'stone_furnace') {
          placeStoneFurnace(hovered.tileX, hovered.tileY)
        } else if (selectedBuild === 'burner_inserter') {
          placeBurnerInserter(hovered.tileX, hovered.tileY, buildDirection)
        }
      }
    }

    if (consumePressed('f') && hovered) {
      const fueled = fuelBuildingAtTile(hovered.tileX, hovered.tileY)
      if (!fueled && openedBuilding) {
        storeOneCoalInBuilding(openedBuilding)
      }
    }

    if (openedBuilding && consumePressed('g')) {
      takeOneFromBuilding(openedBuilding)
    }

    updateBuildings(dt)

    if (!openedBuilding && !selectedBuild) {
      updateMining(dt)
    } else {
      resetMining()
    }
  }

  function render() {
    ctx.fillStyle = '#222'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    if (mapState.open) {
      renderMap(ctx, canvas.width, canvas.height)
      return
    }

    drawTerrain()
    drawGrid()
    drawObjects()
    renderBuildings(ctx)
    drawHoverAndGhost()
    drawPlayer()
    drawMiningProgress()
    drawCompactInventory()
    drawBuildUi(selectedBuild, buildDirection, openedBuilding)

    if (openedBuilding) {
      drawBuildingPanel(openedBuilding)
    }

    if (isInventoryUiOpen()) {
      drawInventoryMenu()
    }
  }

  function drawTerrain() {
    const bounds = getVisibleTileBounds()

    for (let tileY = bounds.startTileY; tileY <= bounds.endTileY; tileY++) {
      for (let tileX = bounds.startTileX; tileX <= bounds.endTileX; tileX++) {
        if (!isTileExplored(tileX, tileY)) continue

        const screen = worldToScreen(tileX * TILE_SIZE, tileY * TILE_SIZE)

        ctx.fillStyle = '#4c8a3f'
        ctx.fillRect(screen.x, screen.y, TILE_SIZE, TILE_SIZE)

        if (!isTileVisible(tileX, tileY)) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
          ctx.fillRect(screen.x, screen.y, TILE_SIZE, TILE_SIZE)
        }
      }
    }
  }

  function drawGrid() {
    const bounds = getVisibleTileBounds()

    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1

    for (let tileY = bounds.startTileY; tileY <= bounds.endTileY; tileY++) {
      for (let tileX = bounds.startTileX; tileX <= bounds.endTileX; tileX++) {
        if (!isTileExplored(tileX, tileY)) continue

        const screen = worldToScreen(tileX * TILE_SIZE, tileY * TILE_SIZE)
        ctx.strokeRect(screen.x, screen.y, TILE_SIZE, TILE_SIZE)
      }
    }
  }

  function drawObjects() {
    const bounds = getVisibleTileBounds()

    for (let tileY = bounds.startTileY; tileY <= bounds.endTileY; tileY++) {
      for (let tileX = bounds.startTileX; tileX <= bounds.endTileX; tileX++) {
        if (!isTileExplored(tileX, tileY)) continue

        const tile = getTileAtWorldTile(tileX, tileY)
        const object = tile.object
        if (!object) continue

        const screen = worldToScreen(tileX * TILE_SIZE, tileY * TILE_SIZE)

        if (object.type === 'tree') {
          ctx.fillStyle = '#6b4f2a'
          ctx.fillRect(screen.x + 13, screen.y + 16, 6, 10)

          ctx.fillStyle = '#2e8b57'
          ctx.fillRect(screen.x + 8, screen.y + 7, 16, 10)
          ctx.fillRect(screen.x + 6, screen.y + 12, 8, 8)
          ctx.fillRect(screen.x + 18, screen.y + 12, 8, 8)
        }

        if (object.type === 'iron_ore') {
          ctx.fillStyle = '#5f646b'
          ctx.fillRect(screen.x + 6, screen.y + 8, 20, 16)

          ctx.fillStyle = '#9aa3ad'
          ctx.fillRect(screen.x + 9, screen.y + 10, 5, 5)
          ctx.fillRect(screen.x + 16, screen.y + 13, 4, 4)
          ctx.fillRect(screen.x + 20, screen.y + 10, 3, 3)
        }

        if (object.type === 'coal') {
          ctx.fillStyle = '#1e1e22'
          ctx.fillRect(screen.x + 6, screen.y + 8, 20, 16)

          ctx.fillStyle = '#3a3a40'
          ctx.fillRect(screen.x + 10, screen.y + 11, 4, 3)
          ctx.fillRect(screen.x + 17, screen.y + 14, 3, 3)
          ctx.fillRect(screen.x + 20, screen.y + 10, 3, 2)
        }

        if (!isTileVisible(tileX, tileY)) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
          ctx.fillRect(screen.x, screen.y, TILE_SIZE, TILE_SIZE)
        }
      }
    }
  }

  function drawPlayer() {
    const screen = worldToScreen(player.x, player.y)
    drawPlayerSprite(screen.x, screen.y)
  }

  function drawFallbackPlayerSprite(screenX: number, screenY: number) {
    const walkFrame = Math.floor(player.animTime) % 2
    const legOffset = player.moving ? (walkFrame === 0 ? -2 : 2) : 0
    const armOffset = player.moving ? (walkFrame === 0 ? 2 : -2) : 0

    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.beginPath()
    ctx.ellipse(screenX + 12, screenY + 22, 8, 4, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#2f5aa8'
    ctx.fillRect(screenX + 7, screenY + 15, 4, 8 + legOffset)
    ctx.fillRect(screenX + 13, screenY + 15, 4, 8 - legOffset)

    ctx.fillStyle = '#4da6ff'
    ctx.fillRect(screenX + 6, screenY + 7, 12, 10)

    ctx.fillStyle = '#f2c18d'
    ctx.fillRect(screenX + 3, screenY + 8, 3, 7 + armOffset)
    ctx.fillRect(screenX + 18, screenY + 8, 3, 7 - armOffset)

    ctx.fillStyle = '#f2c18d'
    ctx.fillRect(screenX + 7, screenY + 1, 10, 8)

    ctx.fillStyle = '#111'
    if (player.facing === 'down') {
      ctx.fillRect(screenX + 9, screenY + 4, 1, 1)
      ctx.fillRect(screenX + 13, screenY + 4, 1, 1)
    }

    if (player.facing === 'up') {
      ctx.fillStyle = '#224477'
      ctx.fillRect(screenX + 8, screenY + 8, 8, 6)
    } else if (player.facing === 'left') {
      ctx.fillStyle = '#224477'
      ctx.fillRect(screenX + 6, screenY + 9, 3, 6)
    } else if (player.facing === 'right') {
      ctx.fillStyle = '#224477'
      ctx.fillRect(screenX + 15, screenY + 9, 3, 6)
    }
  }

  function drawPlayerSprite(screenX: number, screenY: number) {
    const sprite = getGameSprite('player')

    if (sprite && sprite.complete && sprite.naturalWidth > 0) {
      ctx.save()
      ctx.drawImage(sprite, screenX - 8, screenY - 16, 48, 48)
      ctx.restore()
      return
    }

    drawFallbackPlayerSprite(screenX, screenY)
  }

  function drawHoverAndGhost() {
    const hovered = getTileAtScreenPosition(mouse.x, mouse.y)
    if (!hovered || !isTileExplored(hovered.tileX, hovered.tileY)) return

    const screen = worldToScreen(hovered.tileX * TILE_SIZE, hovered.tileY * TILE_SIZE)

    if (selectedBuild) {
      const valid = canPlaceBuilding(selectedBuild, hovered.tileX, hovered.tileY)
      renderBuildingGhost(
        ctx,
        selectedBuild,
        hovered.tileX,
        hovered.tileY,
        buildDirection,
        valid,
      )
    } else {
      ctx.strokeStyle = 'yellow'
      ctx.lineWidth = 2
      ctx.strokeRect(screen.x + 1, screen.y + 1, TILE_SIZE - 2, TILE_SIZE - 2)
    }

    const building = getBuildingAtTile(hovered.tileX, hovered.tileY)
    if (!building) return

    const lines = getBuildingTooltipLines(building)
    const boxWidth = 240
    const boxHeight = 10 + lines.length * 15

    ctx.fillStyle = 'rgba(0, 0, 0, 0.82)'
    ctx.fillRect(screen.x, screen.y - boxHeight - 4, boxWidth, boxHeight)

    ctx.fillStyle = 'white'
    ctx.font = '12px sans-serif'

    lines.forEach((line, index) => {
      ctx.fillText(line, screen.x + 5, screen.y - boxHeight + 12 + index * 15)
    })
  }

  function drawMiningProgress() {
    const target = getMiningTarget()
    if (!target || !isTileExplored(target.tileX, target.tileY)) return

    const progress = getMiningProgress()
    const screen = worldToScreen(target.tileX * TILE_SIZE, target.tileY * TILE_SIZE)

    ctx.fillStyle = 'black'
    ctx.fillRect(screen.x + 4, screen.y + 2, TILE_SIZE - 8, 6)

    ctx.fillStyle = 'lime'
    ctx.fillRect(screen.x + 4, screen.y + 2, (TILE_SIZE - 8) * progress, 6)
  }

  function drawCompactInventory() {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
    ctx.fillRect(10, 10, 230, 120)

    ctx.fillStyle = 'black'
    ctx.font = '14px sans-serif'
    ctx.fillText('Inventory', 20, 30)

    let y = 52
    const shown = inventory.slice(0, 4)
    for (const stack of shown) {
      ctx.fillText(`${stack.item}: ${stack.count}`, 20, y)
      y += 18
    }

    if (shown.length === 0) {
      ctx.fillText('(empty)', 20, y)
    }
  }

  function drawBuildUi(
    currentBuild: BuildSelection,
    currentDirection: Direction,
    currentOpenBuilding: Building | null,
  ) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)'
    ctx.fillRect(10, canvas.height - 88, 980, 78)

    ctx.fillStyle = 'white'
    ctx.font = '16px sans-serif'
    ctx.fillText(`Build: ${currentBuild ?? 'none'}`, 20, canvas.height - 58)
    ctx.fillText(`Direction: ${currentDirection}`, 180, canvas.height - 58)
    ctx.fillText(`Open: ${currentOpenBuilding ? currentOpenBuilding.type : 'none'}`, 340, canvas.height - 58)
    ctx.fillText(
      '1=drill  2=chest  3=belt  4=furnace  5=inserter  R=rotate  Right Click=place  E=open  G=take  F=fuel/store coal  X=deconstruct  Tab/I=inventory  M=map',
      20,
      canvas.height - 28,
    )
  }

  function drawBuildingPanel(building: Building) {
    const panelX = canvas.width - 320
    const panelY = 20
    const panelW = 290
    const panelH = 210

    ctx.fillStyle = 'rgba(20, 20, 20, 0.9)'
    ctx.fillRect(panelX, panelY, panelW, panelH)

    ctx.strokeStyle = '#bdbdbd'
    ctx.lineWidth = 2
    ctx.strokeRect(panelX, panelY, panelW, panelH)

    ctx.fillStyle = 'white'
    ctx.font = '18px sans-serif'

    if (building.type === 'burner_drill') {
      ctx.fillText('Burner Drill', panelX + 14, panelY + 28)
      const output = building.outputItem ? `${building.outputItem} x${building.outputCount}` : 'empty'
      ctx.font = '14px sans-serif'
      ctx.fillText(`Fuel: ${building.fuel.toFixed(1)}`, panelX + 14, panelY + 58)
      ctx.fillText(`Direction: ${building.direction}`, panelX + 14, panelY + 80)
      ctx.fillText(`Output: ${output}`, panelX + 14, panelY + 102)
      ctx.fillText('2x2 footprint', panelX + 14, panelY + 124)
      ctx.fillText('F = add coal/wood fuel', panelX + 14, panelY + 146)
      ctx.fillText('G = take one output item', panelX + 14, panelY + 168)
      return
    }

    if (building.type === 'wooden_chest') {
      ctx.fillText('Wooden Chest', panelX + 14, panelY + 28)
      const stored = building.item ? `${building.item} x${building.count}` : 'empty'
      ctx.font = '14px sans-serif'
      ctx.fillText(`Stored: ${stored}`, panelX + 14, panelY + 58)
      ctx.fillText(`Capacity: ${building.count}/${building.capacity}`, panelX + 14, panelY + 80)
      ctx.fillText('F = store 1 coal', panelX + 14, panelY + 132)
      ctx.fillText('G = take 1 item', panelX + 14, panelY + 152)
      return
    }

    if (building.type === 'transport_belt') {
      ctx.fillText('Transport Belt', panelX + 14, panelY + 28)
      ctx.font = '14px sans-serif'
      ctx.fillText(`Direction: ${building.direction}`, panelX + 14, panelY + 58)
      ctx.fillText(`Item: ${building.item ?? 'empty'}`, panelX + 14, panelY + 80)
      ctx.fillText(`Progress: ${building.item ? building.itemProgress.toFixed(2) : '0.00'}`, panelX + 14, panelY + 102)
      ctx.fillText('F = place 1 coal on belt', panelX + 14, panelY + 132)
      ctx.fillText('G = take belt item', panelX + 14, panelY + 152)
      return
    }

    if (building.type === 'burner_inserter') {
      ctx.fillText('Burner Inserter', panelX + 14, panelY + 28)
      ctx.font = '14px sans-serif'
      ctx.fillText(`Fuel: ${building.fuel.toFixed(1)}`, panelX + 14, panelY + 58)
      ctx.fillText(`Direction: ${building.direction}`, panelX + 14, panelY + 80)
      ctx.fillText(`Held: ${building.heldItem ?? 'empty'}`, panelX + 14, panelY + 102)
      ctx.fillText(`Swing: ${building.progress.toFixed(2)}`, panelX + 14, panelY + 124)
      ctx.fillText('F = add coal fuel', panelX + 14, panelY + 146)
      ctx.fillText('G = take held item', panelX + 14, panelY + 168)
      return
    }

    ctx.fillText('Stone Furnace', panelX + 14, panelY + 28)
    ctx.font = '14px sans-serif'
    ctx.fillText(`Fuel: ${building.fuel.toFixed(1)}`, panelX + 14, panelY + 58)
    ctx.fillText(
      `Input: ${(building.inputItem ?? 'empty')} x${building.inputCount}/${building.inputCapacity}`,
      panelX + 14,
      panelY + 80,
    )
    ctx.fillText(
      `Output: ${(building.outputItem ?? 'empty')} x${building.outputCount}/${building.outputCapacity}`,
      panelX + 14,
      panelY + 102,
    )
    ctx.fillText(`Progress: ${building.progress.toFixed(2)}`, panelX + 14, panelY + 124)
    ctx.fillText('2x2 footprint', panelX + 14, panelY + 146)
    ctx.fillText('F = add coal/wood fuel', panelX + 14, panelY + 168)
    ctx.fillText('G = take one output item', panelX + 14, panelY + 190)
  }

  function drawInventoryMenu() {
    const panelW = 520
    const panelH = 340
    const panelX = Math.floor((canvas.width - panelW) / 2)
    const panelY = Math.floor((canvas.height - panelH) / 2)

    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = 'rgba(26, 26, 26, 0.96)'
    ctx.fillRect(panelX, panelY, panelW, panelH)

    ctx.strokeStyle = '#d0d0d0'
    ctx.lineWidth = 2
    ctx.strokeRect(panelX, panelY, panelW, panelH)

    ctx.fillStyle = 'white'
    ctx.font = '22px sans-serif'
    ctx.fillText('Inventory', panelX + 18, panelY + 32)

    const cols = 5
    const slotSize = 84
    const startX = panelX + 18
    const startY = panelY + 56

    for (let i = 0; i < 15; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = startX + col * (slotSize + 10)
      const y = startY + row * (slotSize + 10)

      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
      ctx.fillRect(x, y, slotSize, slotSize)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
      ctx.strokeRect(x, y, slotSize, slotSize)

      const stack = inventory[i]
      if (!stack) continue

      ctx.fillStyle =
        stack.item === 'coal'
          ? '#bdbdbd'
          : stack.item === 'iron_ore'
            ? '#d7dee7'
            : stack.item === 'iron_plate'
              ? '#eceff4'
              : '#8bc34a'
      ctx.fillRect(x + 10, y + 10, 20, 20)
      ctx.fillStyle = 'white'
      ctx.font = '13px sans-serif'
      ctx.fillText(stack.item, x + 10, y + 46)
      ctx.fillText(`x${stack.count}`, x + 10, y + 64)
    }

    ctx.fillStyle = '#e0e0e0'
    ctx.font = '14px sans-serif'
    ctx.fillText('Tab / I / Esc = close', panelX + 18, panelY + panelH - 18)
  }

  updateCamera(player.x + player.size / 2, player.y + player.size / 2, canvas.width, canvas.height)
  updateVisibility(player.x + player.size / 2, player.y + player.size / 2, 10)

  requestAnimationFrame(loop)
}