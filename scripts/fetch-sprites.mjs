// Idempotent sprite downloader. Reads SPRITES manifest, queries wiki.factorio.com
// MediaWiki API for each file's thumbnail URL, downloads PNGs into
// src/components/sprites/<key>.png. Re-running skips files already on disk.
//
// Usage:  node scripts/fetch-sprites.mjs
//         node scripts/fetch-sprites.mjs --force   (re-download everything)
//
// Image-asset notice: Factorio sprites are owned by Wube Software. The
// wiki text is CC, the images are not. Use only for personal / learning
// projects; do not redistribute or use commercially.

import { mkdir, writeFile, access, constants } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'src', 'components', 'sprites')
const force = process.argv.includes('--force')

// key (used as <key>.png filename + sprite-cache key) -> wiki File: name
const SPRITES = {
  // resources / raw items (inventory icons — small refined chunks)
  iron_ore: 'Iron_ore.png',
  copper_ore: 'Copper_ore.png',
  coal: 'Coal.png',
  stone: 'Stone.png',
  wood: 'Wood.png',
  // ground-tile ore patches (in-world rendering — clusters of chunks)
  iron_ore_field: 'Iron_ore_entity.png',
  copper_ore_field: 'Copper_ore_entity.png',
  coal_field: 'Coal_entity.png',
  stone_field: 'Stone_entity.png',
  // intermediate / smelted
  iron_plate: 'Iron_plate.png',
  copper_plate: 'Copper_plate.png',
  stone_brick: 'Stone_brick.png',
  iron_gear_wheel: 'Iron_gear_wheel.png',
  copper_cable: 'Copper_cable.png',
  electronic_circuit: 'Electronic_circuit.png',
  iron_stick: 'Iron_stick.png',
  // entities / buildings
  burner_drill: 'Burner_mining_drill.png',
  wooden_chest: 'Wooden_chest.png',
  iron_chest: 'Iron_chest.png',
  transport_belt: 'Transport_belt.png',
  stone_furnace: 'Stone_furnace.png',
  burner_inserter: 'Burner_inserter.png',
  // world objects
  tree: 'Tree.png',
  // entities at scale
  player: 'Player.png',
}

const API = 'https://wiki.factorio.com/api.php'
const WIDTH = 64
const UA = 'factorio-clone-sprite-fetcher/1.0 (https://github.com/JJtmc1234/factorio-clone)'

async function exists(path) {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function fetchSpriteUrl(filename, fullRes = false) {
  const params = new URLSearchParams({
    action: 'query',
    titles: `File:${filename}`,
    prop: 'imageinfo',
    iiprop: 'url',
    format: 'json',
    redirects: '1',
  })
  // Item icons get downsampled to WIDTH for fast load. Ore-field tile
  // textures and animations need the full resolution to look right.
  if (!fullRes) params.set('iiurlwidth', String(WIDTH))

  const r = await fetch(`${API}?${params}`, { headers: { 'User-Agent': UA } })
  if (!r.ok) throw new Error(`API HTTP ${r.status}`)
  const data = await r.json()
  const pages = data?.query?.pages
  if (!pages) return null
  const page = Object.values(pages)[0]
  if (page?.missing !== undefined || page?.invalid !== undefined) return null
  const info = page?.imageinfo?.[0]
  return info?.thumburl ?? info?.url ?? null
}

async function downloadFile(url, dest) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!r.ok) throw new Error(`download HTTP ${r.status}`)
  const ab = await r.arrayBuffer()
  await writeFile(dest, Buffer.from(ab))
}

async function main() {
  await mkdir(outDir, { recursive: true })

  let downloaded = 0
  let cached = 0
  let failed = 0

  for (const [key, filename] of Object.entries(SPRITES)) {
    const dest = join(outDir, `${key}.png`)
    if (!force && (await exists(dest))) {
      cached++
      console.log(`  cached  ${key}`)
      continue
    }
    try {
      const fullRes = key.endsWith('_field') || key.endsWith('_anim')
      const url = await fetchSpriteUrl(filename, fullRes)
      if (!url) {
        failed++
        console.log(`  missing ${key} (no File:${filename})`)
        continue
      }
      await downloadFile(url, dest)
      downloaded++
      console.log(`  ok      ${key}  <-  ${filename}`)
    } catch (err) {
      failed++
      console.log(`  fail    ${key}: ${err.message}`)
    }
  }

  console.log(`\n${downloaded} downloaded, ${cached} cached, ${failed} failed.`)
  if (failed > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
