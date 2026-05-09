import { worldToScreen } from '../camera'
import { TILE_SIZE, getTileAtWorldTile, getVisibleTileBounds } from '../world'
import { getGameSprite, isSpriteReady } from '../../components/gameSprites'

const BIOME_COLORS: Record<string, string> = {
  dirt: '#8b6c40',
  grass: '#4c8a3f',
  grass_lush: '#3a6f2c',
}

// Cheap deterministic per-tile hash for terrain micro-variation. Same input
// always returns the same bias, so tiles don't shimmer between frames.
function tileHash(tileX: number, tileY: number): number {
  let h = (tileX | 0) * 374761393 + (tileY | 0) * 668265263
  h = (h ^ (h >>> 13)) * 1274126177
  h = h ^ (h >>> 16)
  return (h >>> 0) / 4294967295
}

function shadeColor(hex: string, deltaPercent: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const adj = (c: number) => Math.max(0, Math.min(255, Math.round(c * (1 + deltaPercent))))
  return `rgb(${adj(r)},${adj(g)},${adj(b)})`
}

function biomeTileSprite(biome: string): HTMLImageElement | null {
  // grass_lush also uses grass; dirt uses dirt.
  if (biome === 'dirt') return getGameSprite('dirt_tile')
  return getGameSprite('grass_tile')
}

// In Factorio, the terrain *.png is laid out as an 8×8 grid of base
// variations (the leftmost 256×256 region) followed by transition tiles to
// the right. We sample only the base variations so we don't accidentally
// pull a transition mask.
export function drawTerrain(ctx: CanvasRenderingContext2D) {
  const bounds = getVisibleTileBounds()

  for (let tileY = bounds.startTileY; tileY <= bounds.endTileY; tileY++) {
    for (let tileX = bounds.startTileX; tileX <= bounds.endTileX; tileX++) {
      const screen = worldToScreen(tileX * TILE_SIZE, tileY * TILE_SIZE)
      const tile = getTileAtWorldTile(tileX, tileY)
      const sprite = biomeTileSprite(tile.biome)

      if (sprite && isSpriteReady(sprite)) {
        // Pick a 32×32 sub-region from the base-variation patch using a
        // tile-coord hash so adjacent tiles look organically different
        // without per-frame shimmer.
        const seed = tileHash(tileX, tileY)
        const cell = Math.floor(seed * 64) // 0..63 (8×8 grid)
        const sx = (cell % 8) * TILE_SIZE
        const sy = Math.floor(cell / 8) * TILE_SIZE
        ctx.drawImage(
          sprite,
          sx,
          sy,
          TILE_SIZE,
          TILE_SIZE,
          screen.x,
          screen.y,
          TILE_SIZE,
          TILE_SIZE,
        )
        continue
      }

      // Fallback: solid biome color with per-tile brightness variance.
      const base = BIOME_COLORS[tile.biome] ?? '#4c8a3f'
      const variance = (tileHash(tileX, tileY) - 0.5) * 0.18
      ctx.fillStyle = shadeColor(base, variance)
      ctx.fillRect(screen.x, screen.y, TILE_SIZE, TILE_SIZE)
    }
  }
}

export function drawGrid(ctx: CanvasRenderingContext2D) {
  const bounds = getVisibleTileBounds()

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)'

  for (let tileY = bounds.startTileY; tileY <= bounds.endTileY; tileY++) {
    for (let tileX = bounds.startTileX; tileX <= bounds.endTileX; tileX++) {
      const tile = getTileAtWorldTile(tileX, tileY)
      // Don't outline tiles that have an object on them — the grid line
      // bleeds through any transparent pixels of the ore-field sprite,
      // making patches look like a chessboard.
      if (tile.object) continue
      const screen = worldToScreen(tileX * TILE_SIZE, tileY * TILE_SIZE)
      ctx.strokeRect(screen.x, screen.y, TILE_SIZE, TILE_SIZE)
    }
  }
}

function drawOreFallback(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  bg: string,
  fg: string,
) {
  ctx.fillStyle = bg
  ctx.fillRect(screenX + 6, screenY + 8, 20, 16)
  ctx.fillStyle = fg
  ctx.fillRect(screenX + 9, screenY + 10, 5, 5)
  ctx.fillRect(screenX + 16, screenY + 13, 4, 4)
  ctx.fillRect(screenX + 20, screenY + 10, 3, 3)
}

const ORE_FALLBACK_COLORS: Record<string, [string, string]> = {
  iron_ore: ['#3a4a5e', '#7a8aa3'],
  copper_ore: ['#7a4a1f', '#c98046'],
  stone: ['#776550', '#b8a487'],
  coal: ['#1e1e22', '#3a3a40'],
}


export function drawObjects(ctx: CanvasRenderingContext2D) {
  const bounds = getVisibleTileBounds()

  for (let tileY = bounds.startTileY; tileY <= bounds.endTileY; tileY++) {
    for (let tileX = bounds.startTileX; tileX <= bounds.endTileX; tileX++) {
      const tile = getTileAtWorldTile(tileX, tileY)
      const object = tile.object
      if (!object) continue

      const screen = worldToScreen(tileX * TILE_SIZE, tileY * TILE_SIZE)
      const sprite = getGameSprite(object.type)

      if (object.type === 'tree') {
        if (isSpriteReady(sprite)) {
          // Trees are taller than wide; anchor near bottom of tile so the
          // crown overlaps the row above and the base sits on the ground.
          ctx.drawImage(sprite, screen.x - 8, screen.y - 18, 48, 52)
        } else {
          ctx.fillStyle = '#6b4f2a'
          ctx.fillRect(screen.x + 13, screen.y + 16, 6, 10)
          ctx.fillStyle = '#2e8b57'
          ctx.fillRect(screen.x + 8, screen.y + 7, 16, 10)
          ctx.fillRect(screen.x + 6, screen.y + 12, 8, 8)
          ctx.fillRect(screen.x + 18, screen.y + 12, 8, 8)
        }
        continue
      }

      // Ores: prefer the actual Factorio per-stage chunk sheet
      // (1024×1024, 8×8 grid of 128px variations). Fall back to the
      // inventory item icon if the particle sheet isn't loaded.
      const particleSheet = getGameSprite(`${object.type}_particle`)
      if (particleSheet && isSpriteReady(particleSheet)) {
        drawOreParticles(ctx, particleSheet, screen.x, screen.y, tileX, tileY)
      } else if (isSpriteReady(sprite)) {
        drawScatteredOreChunks(ctx, sprite, screen.x, screen.y, tileX, tileY)
      } else {
        const colors = ORE_FALLBACK_COLORS[object.type]
        if (colors) drawOreFallback(ctx, screen.x, screen.y, colors[0], colors[1])
      }
    }
  }
}

function drawScatteredOreChunks(
  ctx: CanvasRenderingContext2D,
  chunk: HTMLImageElement,
  screenX: number,
  screenY: number,
  tileX: number,
  tileY: number,
) {
  // Deterministic per-tile placement so tiles don't shimmer between frames.
  // Seed mixes both coords so adjacent tiles look genuinely different.
  let seed = (tileX * 374761393) ^ (tileY * 668265263)
  const rand = () => {
    seed = (seed ^ (seed >>> 13)) * 1274126177
    seed = seed ^ (seed >>> 16)
    return ((seed >>> 0) % 10000) / 10000
  }

  const chunkCount = 4 + Math.floor(rand() * 3) // 4-6 chunks
  for (let i = 0; i < chunkCount; i++) {
    const cx = rand() * (TILE_SIZE - 12)
    const cy = rand() * (TILE_SIZE - 12)
    const size = 10 + Math.floor(rand() * 6) // 10-15 px
    ctx.drawImage(chunk, screenX + cx, screenY + cy, size, size)
  }
}

const ORE_PARTICLE_GRID_SIZE = 128 // each cell in the 8×8 sheet
const ORE_PARTICLE_VARIATIONS = 8

// Draw scattered ore particles using the in-game per-stage sheet. Each
// scattered chunk samples one of the 64 variants in the 8×8 grid based on
// a tile-stable hash so the same tile always renders identically.
function drawOreParticles(
  ctx: CanvasRenderingContext2D,
  sheet: HTMLImageElement,
  screenX: number,
  screenY: number,
  tileX: number,
  tileY: number,
) {
  let seed = (tileX * 374761393) ^ (tileY * 668265263)
  const rand = () => {
    seed = (seed ^ (seed >>> 13)) * 1274126177
    seed = seed ^ (seed >>> 16)
    return ((seed >>> 0) % 10000) / 10000
  }

  const chunkCount = 5 + Math.floor(rand() * 3) // 5-7 chunks
  for (let i = 0; i < chunkCount; i++) {
    const variantCol = Math.floor(rand() * ORE_PARTICLE_VARIATIONS)
    const variantRow = Math.floor(rand() * ORE_PARTICLE_VARIATIONS)
    const sx = variantCol * ORE_PARTICLE_GRID_SIZE
    const sy = variantRow * ORE_PARTICLE_GRID_SIZE
    const cx = rand() * (TILE_SIZE - 14)
    const cy = rand() * (TILE_SIZE - 14)
    const size = 12 + Math.floor(rand() * 6) // 12-17 px

    ctx.drawImage(
      sheet,
      sx,
      sy,
      ORE_PARTICLE_GRID_SIZE,
      ORE_PARTICLE_GRID_SIZE,
      screenX + cx,
      screenY + cy,
      size,
      size,
    )
  }
}
