// Idempotent recipe fetcher. For each entry in RECIPES, fetches the
// `Infobox:<Page>` wikitext from wiki.factorio.com and parses the
// `recipe = Time, T + Item, A + ... [= Output, N]` field plus `producers`.
// Writes src/game/recipes.generated.ts.
//
// Usage:  node scripts/fetch-recipes.mjs
//         node scripts/fetch-recipes.mjs --force
//
// Format reference (see Infobox:Wooden_chest):
//   recipe    = Time, 0.5 + Wood, 2
//   producers = Assembling machine + Player
//
// The wiki's recipe field uses display names ("Iron gear wheel"); the runtime
// uses kebab keys ("iron-gear-wheel"). We translate at write time.
//
// Wiki text is CC-licensed; we redistribute parsed numeric/recipe data only.

import { writeFile, readFile, access, constants } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outFile = join(__dirname, '..', 'src', 'game', 'recipes.generated.ts')
const cacheFile = join(__dirname, '..', 'src', 'game', 'recipes.generated.json')
const force = process.argv.includes('--force')

// recipe-key (kebab) -> wiki page name (Title_With_Underscores).
// Page is the public item page; we fetch its Infobox: companion.
// Recipes that should not be hand-craftable in the current build, even if the
// wiki says they are. Each entry strips 'player' from madeIn and (optionally)
// stamps a tech gate so the future tech tree can re-enable them.
const HANDCRAFT_LOCKS = {
  'iron-stick': { tech: 'medium-electric-pole' },
}

const RECIPES = {
  'iron-plate': 'Iron_plate',
  'copper-plate': 'Copper_plate',
  'stone-brick': 'Stone_brick',
  'iron-gear-wheel': 'Iron_gear_wheel',
  'iron-stick': 'Iron_stick',
  'copper-cable': 'Copper_cable',
  'electronic-circuit': 'Electronic_circuit',
  'wooden-chest': 'Wooden_chest',
  'iron-chest': 'Iron_chest',
  'stone-furnace': 'Stone_furnace',
  'burner-mining-drill': 'Burner_mining_drill',
  'burner-inserter': 'Burner_inserter',
  'transport-belt': 'Transport_belt',
}

const API = 'https://wiki.factorio.com/api.php'
const UA = 'factorio-clone-recipe-fetcher/1.0 (https://github.com/JJtmc1234/factorio-clone)'

// Producer display name -> internal madeIn token. Anything not listed falls
// back to a kebab-cased version of the display name.
const PRODUCER_MAP = {
  'Assembling machine': 'assembler',
  'Player': 'player',
  'Furnace': 'furnace',
  'Foundry': 'foundry',
  'Chemical plant': 'chemical-plant',
  'Biochamber': 'biochamber',
  'Electromagnetic plant': 'electromagnetic-plant',
  'Cryogenic plant': 'cryogenic-plant',
}

// Producer -> recipe category. Mirrors how the manual recipes.ts categorizes.
const PRODUCER_CATEGORY = {
  furnace: 'smelting',
  'chemical-plant': 'chemistry',
  biochamber: 'organic',
  foundry: 'metallurgy',
  'electromagnetic-plant': 'electromagnetics',
  'cryogenic-plant': 'cryogenics',
  assembler: 'crafting',
  player: 'crafting',
}

function toKebab(displayName) {
  return displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function exists(path) {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function fetchInfoboxWikitext(pageName) {
  const params = new URLSearchParams({
    action: 'parse',
    page: `Infobox:${pageName}`,
    prop: 'wikitext',
    format: 'json',
    redirects: '1',
  })
  const r = await fetch(`${API}?${params}`, { headers: { 'User-Agent': UA } })
  if (!r.ok) throw new Error(`API HTTP ${r.status}`)
  const data = await r.json()
  if (data?.error) throw new Error(data.error.info || 'API error')
  const text = data?.parse?.wikitext?.['*']
  if (!text) throw new Error('no wikitext in response')
  return text
}

// Read a single |key = value pair out of an Infobox-style template.
// Stops at the next |key = or closing }}.
function readInfoboxField(wikitext, key) {
  const re = new RegExp(`\\|\\s*${key}\\s*=\\s*([^\\n]*)`, 'i')
  const m = wikitext.match(re)
  return m ? m[1].trim() : null
}

// Parse the `recipe` value: "Time, 0.5 + Iron plate, 8" or
// "Time, 0.5 + Iron gear wheel, 1 + Iron plate, 1 = Transport belt, 2".
function parseRecipeField(value, fallbackOutputKey) {
  if (!value) return null
  const [lhsRaw, rhsRaw] = value.split('=').map((s) => s.trim())
  const lhs = lhsRaw.split('+').map((s) => s.trim())

  let time = null
  const ingredients = {}

  for (const piece of lhs) {
    const [name, amount] = piece.split(',').map((s) => s.trim())
    if (!name || !amount) continue
    if (name.toLowerCase() === 'time') {
      time = Number(amount)
      continue
    }
    const ingKey = toKebab(name)
    if (!ingKey) continue
    ingredients[ingKey] = Number(amount)
  }

  let output
  if (rhsRaw) {
    const [outName, outAmount] = rhsRaw.split(',').map((s) => s.trim())
    output = { [toKebab(outName)]: Number(outAmount) }
  } else {
    output = { [fallbackOutputKey]: 1 }
  }

  if (time === null) return null
  return { time, ingredients, output }
}

// Parse `producers = Assembling machine + Player` into kebab madeIn list.
function parseProducersField(value) {
  if (!value) return []
  return value
    .split('+')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((display) => PRODUCER_MAP[display] ?? toKebab(display))
}

function pickCategory(madeIn) {
  for (const m of madeIn) {
    if (PRODUCER_CATEGORY[m] && m !== 'player') return PRODUCER_CATEGORY[m]
  }
  return 'crafting'
}

async function loadCache() {
  if (force) return {}
  if (!(await exists(cacheFile))) return {}
  try {
    return JSON.parse(await readFile(cacheFile, 'utf8'))
  } catch {
    return {}
  }
}

function recipeToTsLiteral(name, recipe) {
  const ing = JSON.stringify(recipe.ingredients)
  const out = JSON.stringify(recipe.output)
  const made = JSON.stringify(recipe.madeIn)
  const techLine = recipe.tech ? `\n    tech: '${recipe.tech}',` : ''
  return `  '${name}': {
    name: '${name}',
    time: ${recipe.time},
    category: '${recipe.category}',
    madeIn: ${made},${techLine}
    ingredients: ${ing},
    output: ${out},
    surface: 'any',
  },`
}

async function main() {
  const cache = await loadCache()
  const result = {}
  let fetched = 0
  let cached = 0
  let failed = 0

  for (const [recipeKey, page] of Object.entries(RECIPES)) {
    if (!force && cache[recipeKey]) {
      result[recipeKey] = cache[recipeKey]
      cached++
      console.log(`  cached  ${recipeKey}`)
      continue
    }
    try {
      const wikitext = await fetchInfoboxWikitext(page)
      const recipeField = readInfoboxField(wikitext, 'recipe')
      const producersField = readInfoboxField(wikitext, 'producers')
      const parsed = parseRecipeField(recipeField, recipeKey)
      if (!parsed) throw new Error(`could not parse recipe= "${recipeField}"`)
      let madeIn = parseProducersField(producersField)
      const lock = HANDCRAFT_LOCKS[recipeKey]
      if (lock) madeIn = madeIn.filter((m) => m !== 'player')
      const recipe = {
        name: recipeKey,
        time: parsed.time,
        category: pickCategory(madeIn),
        madeIn,
        ...(lock?.tech ? { tech: lock.tech } : {}),
        ingredients: parsed.ingredients,
        output: parsed.output,
        surface: 'any',
      }
      result[recipeKey] = recipe
      fetched++
      console.log(`  ok      ${recipeKey}  <-  Infobox:${page}`)
    } catch (err) {
      failed++
      console.log(`  fail    ${recipeKey}: ${err.message}`)
    }
  }

  // Write JSON cache (keyed by recipeKey) so reruns skip the network.
  await writeFile(cacheFile, JSON.stringify(result, null, 2) + '\n')

  // Write the TS module that recipes.ts imports.
  const lines = [
    '// AUTOGENERATED by scripts/fetch-recipes.mjs from wiki.factorio.com.',
    "// Run `npm run fetch-recipes` to regenerate. Do not edit by hand.",
    '',
    "import type { Recipe } from './recipes-types'",
    '',
    'export const generatedRecipes: Record<string, Recipe> = {',
    ...Object.entries(result).map(([k, r]) => recipeToTsLiteral(k, r)),
    '}',
    '',
  ]
  await writeFile(outFile, lines.join('\n'))

  console.log(`\n${fetched} fetched, ${cached} cached, ${failed} failed.`)
  console.log(`Wrote ${outFile}`)
  if (failed > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
