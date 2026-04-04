export type PlayerFacing = 'up' | 'right' | 'down' | 'left'

export const player = {
  x: 100,
  y: 100,
  speed: 200,
  size: 24,
  facing: 'down' as PlayerFacing,
  moving: false,
  animTime: 0,
}

export function updatePlayer(dt: number, input: Record<string, boolean>) {
  let dx = 0
  let dy = 0

  if (input['w']) dy -= 1
  if (input['s']) dy += 1
  if (input['a']) dx -= 1
  if (input['d']) dx += 1

  const length = Math.hypot(dx, dy)

  if (length > 0) {
    dx /= length
    dy /= length
    player.moving = true
    player.animTime += dt * 10

    if (Math.abs(dx) > Math.abs(dy)) {
      player.facing = dx > 0 ? 'right' : 'left'
    } else {
      player.facing = dy > 0 ? 'down' : 'up'
    }
  } else {
    player.moving = false
  }

  player.x += dx * player.speed * dt
  player.y += dy * player.speed * dt
}