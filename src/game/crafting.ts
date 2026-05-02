import { recipes, type Recipe } from './recipes'
import { addItem, getItemCount, removeItem } from './inventory'

// Item names in inventory.ts use snake_case (e.g. 'iron_plate'); recipes
// use kebab-case (e.g. 'iron-plate'). Translate at the boundary so the rest
// of the game stays free of recipe-string churn.
function toInventoryKey(recipeItemName: string): string {
  return recipeItemName.replace(/-/g, '_')
}

export interface CraftJob {
  recipeName: string
  outputItem: string
  outputCount: number
  remainingTime: number
  totalTime: number
}

const queue: CraftJob[] = []

export function getCraftQueue(): CraftJob[] {
  return queue
}

export function isHandCraftable(recipe: Recipe): boolean {
  return recipe.madeIn.includes('player')
}

let cachedHandCraftable: Recipe[] | null = null
export function getHandCraftableRecipes(): Recipe[] {
  if (!cachedHandCraftable) {
    cachedHandCraftable = Object.values(recipes).filter(isHandCraftable)
  }
  return cachedHandCraftable
}

function normalizeIngredients(ing: Recipe['ingredients']): Record<string, number> {
  if (Array.isArray(ing)) {
    const out: Record<string, number> = {}
    for (const entry of ing) {
      // Skip fluids — early-game hand-craftable recipes have no fluids,
      // but guard against future additions that mix solids and fluids.
      if (entry.type === 'fluid') continue
      out[entry.name] = entry.amount
    }
    return out
  }
  return ing
}

export function getRecipeCost(recipeName: string): Record<string, number> | null {
  const recipe = recipes[recipeName]
  if (!recipe) return null
  return normalizeIngredients(recipe.ingredients)
}

export function canCraft(recipeName: string): boolean {
  const recipe = recipes[recipeName]
  if (!recipe || !isHandCraftable(recipe)) return false

  const cost = normalizeIngredients(recipe.ingredients)
  for (const [name, amount] of Object.entries(cost)) {
    if (getItemCount(toInventoryKey(name)) < amount) return false
  }
  return true
}

export function startCraft(recipeName: string): boolean {
  const recipe = recipes[recipeName]
  if (!recipe || !isHandCraftable(recipe)) return false
  if (!canCraft(recipeName)) return false

  const cost = normalizeIngredients(recipe.ingredients)
  for (const [name, amount] of Object.entries(cost)) {
    if (!removeItem(toInventoryKey(name), amount)) {
      // Roll back already-removed ingredients on partial failure (paranoia).
      for (const [n, a] of Object.entries(cost)) {
        if (n === name) break
        addItem(toInventoryKey(n), a)
      }
      return false
    }
  }

  const outputs = Object.entries(recipe.output)
  if (outputs.length === 0) return false
  const [outputName, outputCount] = outputs[0]

  queue.push({
    recipeName,
    outputItem: toInventoryKey(outputName),
    outputCount,
    remainingTime: recipe.time,
    totalTime: recipe.time,
  })
  return true
}

export function cancelCraft(index = 0): boolean {
  if (index < 0 || index >= queue.length) return false
  const job = queue.splice(index, 1)[0]
  // Refund ingredients of cancelled job.
  const recipe = recipes[job.recipeName]
  if (recipe) {
    const cost = normalizeIngredients(recipe.ingredients)
    for (const [name, amount] of Object.entries(cost)) {
      addItem(toInventoryKey(name), amount)
    }
  }
  return true
}

export function updateCrafting(dt: number) {
  if (queue.length === 0) return

  const head = queue[0]
  head.remainingTime = Math.max(0, head.remainingTime - dt)

  if (head.remainingTime <= 0) {
    addItem(head.outputItem, head.outputCount)
    queue.shift()
  }
}
