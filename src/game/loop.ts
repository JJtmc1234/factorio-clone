import { setupInput, input } from './input'
import { player, updatePlayer } from './player'
import { setupMouse, mouse } from './mouse'
import { world, getTileAtScreenPosition } from './world'

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
    updatePlayer(
      dt,
      input.keys,
      world.width * world.tileSize,
      world.height * world.tileSize
    )
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    drawGrid()
    drawObjects()
    drawPlayer()
    drawHover()
  }

  function drawGrid() {
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1

    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        ctx.strokeRect(
          x * world.tileSize,
          y * world.tileSize,
          world.tileSize,
          world.tileSize
        )
      }
    }
  }

  function drawObjects() {
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const tile = world.tiles[y][x]
        const px = x * world.tileSize
        const py = y * world.tileSize

        if (tile.object === 'tree') {
          ctx.fillStyle = 'green'
          ctx.fillRect(px + 6, py + 6, 20, 20)
        }

        if (tile.object === 'ore') {
          ctx.fillStyle = 'gray'
          ctx.fillRect(px + 6, py + 6, 20, 20)
        }
      }
    }
  }

  function drawPlayer() {
    ctx.fillStyle = 'blue'
    ctx.fillRect(player.x, player.y, 24, 24)
  }

  function drawHover() {
    const hovered = getTileAtScreenPosition(mouse.x, mouse.y)
    if (!hovered) return

    ctx.strokeStyle = 'yellow'
    ctx.lineWidth = 2
    ctx.strokeRect(
      hovered.tileX * world.tileSize,
      hovered.tileY * world.tileSize,
      world.tileSize,
      world.tileSize
    )
  }

  requestAnimationFrame(loop)
}