// Clean restart: practical, scalable Factorio + Space Age recipe schema

export type Ingredient = {
  name: string
  amount: number
  type?: 'item' | 'fluid'
}

export type Recipe = {
  name: string
  time: number
  category: string
  madeIn: string[]
  tech?: string
  ingredients: Record<string, number> | Ingredient[]
  output: Record<string, number>
  surface?: 'any' | 'nauvis' | 'vulcanus' | 'fulgora' | 'gleba' | 'aquilo' | 'space'
}

export const recipes: Record<string, Recipe> = {
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

export default recipes
