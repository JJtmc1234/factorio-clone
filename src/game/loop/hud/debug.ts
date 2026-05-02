import { addItem } from '../../inventory'

const DEBUG_BUTTON_W = 110
const DEBUG_BUTTON_H = 30
const DEBUG_BUTTON_MARGIN = 10

const DEBUG_ITEMS = [
  'iron_ore',
  'copper_ore',
  'stone',
  'coal',
  'wood',
  'iron_plate',
  'copper_plate',
  'stone_brick',
  'iron_gear_wheel',
  'iron_stick',
  'copper_cable',
  'electronic_circuit',
  'burner_mining_drill',
  'stone_furnace',
  'wooden_chest',
  'iron_chest',
  'transport_belt',
  'burner_inserter',
  'firearm_magazine',
  'light_armor',
  'pistol',
]

function getDebugButtonRect(canvas: HTMLCanvasElement) {
  return {
    x: canvas.width - DEBUG_BUTTON_W - DEBUG_BUTTON_MARGIN,
    y: DEBUG_BUTTON_MARGIN,
    w: DEBUG_BUTTON_W,
    h: DEBUG_BUTTON_H,
  }
}

export function drawDebugButton(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  const r = getDebugButtonRect(canvas)
  ctx.fillStyle = 'rgba(60, 30, 30, 0.92)'
  ctx.fillRect(r.x, r.y, r.w, r.h)
  ctx.strokeStyle = '#ff5252'
  ctx.lineWidth = 2
  ctx.strokeRect(r.x, r.y, r.w, r.h)

  ctx.fillStyle = '#ffcdd2'
  ctx.font = 'bold 12px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('DEBUG +100', r.x + r.w / 2, r.y + r.h / 2)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

export function isDebugButtonHit(canvas: HTMLCanvasElement, mx: number, my: number) {
  const r = getDebugButtonRect(canvas)
  return mx >= r.x && mx < r.x + r.w && my >= r.y && my < r.y + r.h
}

export function grantDebugItems() {
  for (const item of DEBUG_ITEMS) addItem(item, 100)
}
