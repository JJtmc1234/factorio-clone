export const mouse = {
  x: 0,
  y: 0,
  leftDown: false,
  leftPressed: false,
  rightPressed: false,
  // Modifier flags captured at the moment of the most-recent left press.
  // Cleared by consumeLeftPressed alongside the press flag.
  leftPressedCtrl: false,
  leftPressedShift: false,
  // Wheel delta accumulated since last consume. Positive = wheel-down
  // (scroll forward / list down). UI consumers call consumeWheelDelta() to
  // read + reset.
  wheelDelta: 0,
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
      mouse.leftPressed = true
      mouse.leftPressedCtrl = e.ctrlKey || e.metaKey
      mouse.leftPressedShift = e.shiftKey
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

  canvas.addEventListener(
    'wheel',
    (e) => {
      // Normalize wheel delta to "rows" (deltaY is usually 100 per notch on
      // a mouse wheel). Sign: positive = down/forward.
      mouse.wheelDelta += e.deltaY
      e.preventDefault()
    },
    { passive: false },
  )
}

export function consumeLeftPressed() {
  const pressed = mouse.leftPressed
  mouse.leftPressed = false
  mouse.leftPressedCtrl = false
  mouse.leftPressedShift = false
  return pressed
}

export function consumeRightPressed() {
  const pressed = mouse.rightPressed
  mouse.rightPressed = false
  return pressed
}

export function consumeWheelDelta() {
  const d = mouse.wheelDelta
  mouse.wheelDelta = 0
  return d
}