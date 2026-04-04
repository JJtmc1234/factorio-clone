export const input = {
  keys: {} as Record<string, boolean>,
  pressed: {} as Record<string, boolean>,
}

export function setupInput() {
  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase()

    if (!input.keys[key]) {
      input.pressed[key] = true
    }

    input.keys[key] = true
  })

  window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase()
    input.keys[key] = false
  })
}

export function consumePressed(key: string) {
  const lower = key.toLowerCase()
  const wasPressed = !!input.pressed[lower]
  input.pressed[lower] = false
  return wasPressed
}