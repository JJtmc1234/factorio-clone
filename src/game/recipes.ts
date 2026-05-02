// Recipe types live in recipes-types.ts so the auto-generated
// recipes.generated.ts (written by scripts/fetch-recipes.mjs) can import them
// without creating a circular dependency back through this file.
export type { Ingredient, Recipe } from './recipes-types'
import type { Recipe } from './recipes-types'

// Manual recipe table — the historical source of truth. After running
// `npm run fetch-recipes`, wiki-derived values from recipes.generated.ts
// override these for any overlapping keys (see merge below).
const manualRecipes: Record<string, Recipe> = {
  // ===== CORE =====
  'iron-plate': {
    name: 'iron-plate',
    time: 3.2,
    category: 'smelting',
    madeIn: ['furnace'],
    ingredients: { 'iron-ore': 1 },
    output: { 'iron-plate': 1 },
    surface: 'any'
  },

  'copper-plate': {
    name: 'copper-plate',
    time: 3.2,
    category: 'smelting',
    madeIn: ['furnace'],
    ingredients: { 'copper-ore': 1 },
    output: { 'copper-plate': 1 },
    surface: 'any'
  },

  'iron-gear-wheel': {
    name: 'iron-gear-wheel',
    time: 0.5,
    category: 'crafting',
    madeIn: ['assembler', 'player'],
    ingredients: { 'iron-plate': 2 },
    output: { 'iron-gear-wheel': 1 },
    surface: 'any'
  },

  'copper-cable': {
    name: 'copper-cable',
    time: 0.5,
    category: 'crafting',
    madeIn: ['assembler', 'player'],
    ingredients: { 'copper-plate': 1 },
    output: { 'copper-cable': 2 },
    surface: 'any'
  },

  'electronic-circuit': {
    name: 'electronic-circuit',
    time: 0.5,
    category: 'crafting',
    madeIn: ['assembler', 'player'],
    tech: 'electronics',
    ingredients: {
      'copper-cable': 3,
      'iron-plate': 1
    },
    output: { 'electronic-circuit': 1 },
    surface: 'any'
  },

  'advanced-circuit': {
    name: 'advanced-circuit',
    time: 6,
    category: 'crafting',
    madeIn: ['assembler'],
    tech: 'advanced-electronics',
    ingredients: {
      'electronic-circuit': 2,
      'plastic-bar': 2,
      'copper-cable': 4
    },
    output: { 'advanced-circuit': 1 },
    surface: 'any'
  },

  'processing-unit': {
    name: 'processing-unit',
    time: 10,
    category: 'crafting',
    madeIn: ['assembler'],
    tech: 'advanced-electronics-2',
    ingredients: [
      { name: 'electronic-circuit', amount: 20 },
      { name: 'advanced-circuit', amount: 2 },
      { name: 'sulfuric-acid', amount: 5, type: 'fluid' }
    ],
    output: { 'processing-unit': 1 },
    surface: 'any'
  },

  // ===== EARLY-GAME BUILDINGS (hand-craftable) =====
  // Times taken from wiki.factorio.com (Factorio 2.0 / Space Age values).
  'iron-stick': {
    name: 'iron-stick',
    time: 0.5,
    category: 'crafting',
    // Locked: iron-stick is gated behind medium electric poles in vanilla and
    // we don't have a tech tree yet, so it must not appear in the hand-craft
    // menu. Keep the recipe defined for future ingredient routing.
    madeIn: ['assembler'],
    tech: 'medium-electric-pole',
    ingredients: { 'iron-plate': 1 },
    output: { 'iron-stick': 2 },
    surface: 'any',
  },

  'wooden-chest': {
    name: 'wooden-chest',
    time: 0.5,
    category: 'crafting',
    madeIn: ['assembler', 'player'],
    ingredients: { wood: 2 },
    output: { 'wooden-chest': 1 },
    surface: 'any',
  },

  'iron-chest': {
    name: 'iron-chest',
    time: 0.5,
    category: 'crafting',
    madeIn: ['assembler', 'player'],
    ingredients: { 'iron-plate': 8 },
    output: { 'iron-chest': 1 },
    surface: 'any',
  },

  'stone-furnace': {
    name: 'stone-furnace',
    time: 0.5,
    category: 'crafting',
    madeIn: ['assembler', 'player'],
    ingredients: { stone: 5 },
    output: { 'stone-furnace': 1 },
    surface: 'any',
  },

  'burner-mining-drill': {
    name: 'burner-mining-drill',
    time: 2,
    category: 'crafting',
    madeIn: ['assembler', 'player'],
    ingredients: {
      'iron-gear-wheel': 3,
      'iron-plate': 3,
      'stone-furnace': 1,
    },
    output: { 'burner-mining-drill': 1 },
    surface: 'any',
  },

  'burner-inserter': {
    name: 'burner-inserter',
    time: 0.5,
    category: 'crafting',
    madeIn: ['assembler', 'player'],
    ingredients: {
      'iron-gear-wheel': 1,
      'iron-plate': 1,
    },
    output: { 'burner-inserter': 1 },
    surface: 'any',
  },

  // ===== LOGISTICS =====
  'transport-belt': {
    name: 'transport-belt',
    time: 0.5,
    category: 'crafting',
    madeIn: ['assembler', 'player'],
    ingredients: {
      'iron-plate': 1,
      'iron-gear-wheel': 1
    },
    output: { 'transport-belt': 2 },
    surface: 'any'
  },

  inserter: {
    name: 'inserter',
    time: 0.5,
    category: 'crafting',
    madeIn: ['assembler', 'player'],
    tech: 'automation',
    ingredients: {
      'electronic-circuit': 1,
      'iron-gear-wheel': 1,
      'iron-plate': 1
    },
    output: { 'inserter': 1 },
    surface: 'any'
  },

  // ===== OIL =====
  'plastic-bar': {
    name: 'plastic-bar',
    time: 1,
    category: 'chemistry',
    madeIn: ['chemical-plant'],
    tech: 'plastics',
    ingredients: [
      { name: 'coal', amount: 1 },
      { name: 'petroleum-gas', amount: 20, type: 'fluid' }
    ],
    output: { 'plastic-bar': 2 },
    surface: 'any'
  },

  'sulfuric-acid': {
    name: 'sulfuric-acid',
    time: 1,
    category: 'chemistry',
    madeIn: ['chemical-plant'],
    tech: 'sulfur-processing',
    ingredients: [
      { name: 'iron-plate', amount: 1 },
      { name: 'sulfur', amount: 5 },
      { name: 'water', amount: 100, type: 'fluid' }
    ],
    output: { 'sulfuric-acid': 50 },
    surface: 'any'
  },

  // ===== SCIENCE =====
  'automation-science-pack': {
    name: 'automation-science-pack',
    time: 5,
    category: 'crafting',
    madeIn: ['assembler', 'player'],
    ingredients: {
      'copper-plate': 1,
      'iron-gear-wheel': 1
    },
    output: { 'automation-science-pack': 1 },
    surface: 'any'
  },

  'logistic-science-pack': {
    name: 'logistic-science-pack',
    time: 6,
    category: 'crafting',
    madeIn: ['assembler'],
    tech: 'logistic-science-pack',
    ingredients: {
      'transport-belt': 1,
      'inserter': 1
    },
    output: { 'logistic-science-pack': 1 },
    surface: 'any'
  },

  // ===== SPACE AGE EXAMPLES =====
  'tungsten-carbide': {
    name: 'tungsten-carbide',
    time: 2,
    category: 'metallurgy',
    madeIn: ['foundry'],
    tech: 'tungsten-carbide',
    ingredients: {
      'tungsten-ore': 2,
      'carbon': 1
    },
    output: { 'tungsten-carbide': 1 },
    surface: 'vulcanus'
  },

  'superconductor': {
    name: 'superconductor',
    time: 2,
    category: 'electromagnetics',
    madeIn: ['electromagnetic-plant'],
    tech: 'superconductor',
    ingredients: {
      'copper-cable': 8,
      'plastic-bar': 2,
      'holmium-plate': 1
    },
    output: { 'superconductor': 1 },
    surface: 'fulgora'
  },

  'bioflux': {
    name: 'bioflux',
    time: 6,
    category: 'organic',
    madeIn: ['biochamber'],
    tech: 'bioflux',
    ingredients: {
      'yumako-mash': 2,
      'jelly': 2,
      'nutrients': 10
    },
    output: { 'bioflux': 1 },
    surface: 'gleba'
  },

  'quantum-processor': {
    name: 'quantum-processor',
    time: 20,
    category: 'cryogenics',
    madeIn: ['cryogenic-plant'],
    tech: 'quantum-processor',
    ingredients: {
      'processing-unit': 1,
      'superconductor': 1,
      'lithium-plate': 1
    },
    output: { 'quantum-processor': 1 },
    surface: 'aquilo'
  }
}

// Pull in wiki-derived recipes if the generator has been run. Using a
// dynamic-style barrel keeps the build green when the file is missing
// (Vite will emit an empty object). After `npm run fetch-recipes`, generated
// values take precedence, but we preserve any handwritten metadata
// (category/madeIn/tech/surface) by spreading manual *under* generated and
// then re-overlaying our manual extras for any keys the wiki doesn't cover.
import { generatedRecipes } from './recipes.generated'

export const recipes: Record<string, Recipe> = {
  ...manualRecipes,
  ...generatedRecipes,
}

export default recipes
