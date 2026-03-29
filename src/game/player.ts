export const player = {
    x: 100,
    y: 100,
    speed: 200 // pixels per second
  }
  
  export function updatePlayer(dt: number, input: Record<string, boolean>) {
    let dx = 0
    let dy = 0
  
    if (input['w']) dy -= 1
    if (input['s']) dy += 1
    if (input['a']) dx -= 1
    if (input['d']) dx += 1
  
    // normalize diagonal movement
    const length = Math.hypot(dx, dy)
    if (length > 0) {
      dx /= length
      dy /= length
    }
  
    player.x += dx * player.speed * dt
    player.y += dy * player.speed * dt
  }