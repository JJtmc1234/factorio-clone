import { setupInput, input } from './input'
import { player, updatePlayer } from './player'

export function startGame(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D
) {
  setupInput()

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
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = 'blue'
    ctx.fillRect(player.x, player.y, 24, 24)
  }

  requestAnimationFrame(loop)
}