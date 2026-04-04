import { setupInput, input } from './input'
import { player, updatePlayer } from './player'
import { setupMouse, mouse } from './mouse'
import { TILE_SIZE, getTileAtWorldTile, getTileAtScreenPosition } from './world'
import { updateMining, getMiningProgress, getMiningTarget } from './mining'
import { inventory } from './inventory'

let running = false

export function startGame(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D
) {
  if (running) return
  running = true

  setupInput()
  setupMouse(canvas)

  let last = performance.now()

  function loop(now: number) {
    const dt = (now - last) / 1000
    last = now

    update(dt)
    render()

    requestAnimationFrame(loop)
  }

  function update(dt: number) {
    updatePlayer(dt, input.keys)
    updateMining(dt)
  }

  function render() {
    ctx.fillStyle = '#222'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    drawGrid()
    drawObjects()
    drawPlayer()
    drawHover()
    drawMiningProgress()
    drawInventoryDebug()
  }

  function drawGrid() {
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1

    const visibleTilesX = Math.ceil(canvas.width / TILE_SIZE)
    const visibleTilesY = Math.ceil(canvas.height / TILE_SIZE)

    for (let y = 0; y < visibleTilesY; y++) {
      for (let x = 0; x < visibleTilesX; x++) {
        ctx.strokeRect(
          x * TILE_SIZE,
          y * TILE_SIZE,
          TILE_SIZE,
          TILE_SIZE
        )
      }
    }
  }

  function drawObjects() {
    const visibleTilesX = Math.ceil(canvas.width / TILE_SIZE)
    const visibleTilesY = Math.ceil(canvas.height / TILE_SIZE)

    for (let y = 0; y < visibleTilesY; y++) {
      for (let x = 0; x < visibleTilesX; x++) {
        const tile = getTileAtWorldTile(x, y)
        const px = x * TILE_SIZE
        const py = y * TILE_SIZE

        if (tile.object?.type === 'tree') {
          ctx.fillStyle = 'green'
          ctx.fillRect(px + 6, py + 6, 20, 20)
        }

        if (tile.object?.type === 'ore') {
          ctx.fillStyle = 'gray'
          ctx.fillRect(px + 6, py + 6, 20, 20)
        }
      }
    }
  }

  function drawPlayer() {
    ctx.fillStyle = 'blue'
    ctx.fillRect(player.x, player.y, player.size, player.size)
  }

  function drawHover() {
    const hovered = getTileAtScreenPosition(mouse.x, mouse.y)
    if (!hovered) return

    ctx.strokeStyle = 'yellow'
    ctx.lineWidth = 2
    ctx.strokeRect(
      hovered.tileX * TILE_SIZE,
      hovered.tileY * TILE_SIZE,
      TILE_SIZE,
      TILE_SIZE
    )
  }

  function drawMiningProgress() {
    const target = getMiningTarget()
    if (!target) return

    const progress = getMiningProgress()
    const px = target.tileX * TILE_SIZE
    const py = target.tileY * TILE_SIZE

    ctx.fillStyle = 'black'
    ctx.fillRect(px + 4, py + 2, TILE_SIZE - 8, 6)

    ctx.fillStyle = 'lime'
    ctx.fillRect(px + 4, py + 2, (TILE_SIZE - 8) * progress, 6)
  }

  function drawInventoryDebug() {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.fillRect(10, 10, 220, 140)

    ctx.fillStyle = 'black'
    ctx.font = '16px sans-serif'

    let y = 30
    ctx.fillText('Inventory:', 20, y)
    y += 20

    if (inventory.length === 0) {
      ctx.fillText('(empty)', 20, y)
      return
    }

    for (const stack of inventory) {
      ctx.fillText(`${stack.item}: ${stack.count}`, 20, y)
      y += 20
    }
  }

  requestAnimationFrame(loop)
}