export const mouse = {
  x: 0,
  y: 0,
  leftDown: false,
  rightPressed: false,
}

export function setupMouse(canvas: HTMLCanvasElement) {
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault()
  })

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect()
    mouse.x = e.clientX - rect.left
    mouse.y = e.clientY - rect.top
  })

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      mouse.leftDown = true
    }

    if (e.button === 2) {
      mouse.rightPressed = true
    }
  })

  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
      mouse.leftDown = false
    }
  })
}

export function consumeRightPressed() {
  const pressed = mouse.rightPressed
  mouse.rightPressed = false
  return pressed
}