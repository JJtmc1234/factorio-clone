export const input = {
    keys: {} as Record<string, boolean>
  }
  
  export function setupInput() {
    window.addEventListener('keydown', (e) => {
      input.keys[e.key.toLowerCase()] = true
    })
  
    window.addEventListener('keyup', (e) => {
      input.keys[e.key.toLowerCase()] = false
    })
  }