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

function enqueueCraft(recipeName: string): boolean {
  const recipe = recipes[recipeName]
  if (!recipe || !isHandCraftable(recipe)) return false
  if (!canCraft(recipeName)) return false

  const cost = normalizeIngredients(recipe.ingredients)
  for (const [name, amount] of Object.entries(cost)) {
    if (!removeItem(toInventoryKey(name), amount)) {
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

// Index from output kebab name -> recipe key. Lets the auto-prerequisite
// resolver find which hand-craftable recipe produces a given ingredient.
function findRecipeProducing(outputKebab: string): string | null {
  for (const [recipeName, recipe] of Object.entries(recipes)) {
    if (!isHandCraftable(recipe)) continue
    if (Object.prototype.hasOwnProperty.call(recipe.output, outputKebab)) {
      return recipeName
    }
  }
  return null
}

// Walk the recipe DAG in dependency-order and queue prerequisite crafts so
// the target recipe becomes craftable. Returns the list of recipe names to
// queue (target last). Returns null if any prerequisite is not itself
// hand-craftable (e.g. raw ore must be mined manually).
function buildPrerequisitePlan(targetRecipeName: string): string[] | null {
  const target = recipes[targetRecipeName]
  if (!target) return null

  // Track the simulated inventory deltas so we don't double-count items
  // produced by an intermediate craft when sizing the next one.
  const simulated: Record<string, number> = {}
  const getSim = (k: string) => (simulated[k] ?? 0) + getItemCount(k)
  const plan: string[] = []
  const visiting = new Set<string>()

  function ensureFor(recipeName: string): boolean {
    if (visiting.has(recipeName)) return false // cycle guard
    const recipe = recipes[recipeName]
    if (!recipe || !isHandCraftable(recipe)) return false
    visiting.add(recipeName)

    const cost = normalizeIngredients(recipe.ingredients)
    for (const [ingKebab, amount] of Object.entries(cost)) {
      const key = toInventoryKey(ingKebab)
      let need = amount - getSim(key)
      if (need <= 0) continue

      const subRecipeName = findRecipeProducing(ingKebab)
      if (!subRecipeName) return false // raw resource — must be mined

      const subRecipe = recipes[subRecipeName]
      const perBatch = subRecipe.output[ingKebab] ?? 1
      const batches = Math.ceil(need / perBatch)
      for (let b = 0; b < batches; b++) {
        if (!ensureFor(subRecipeName)) return false
        const subCost = normalizeIngredients(subRecipe.ingredients)
        for (const [subIng, subAmount] of Object.entries(subCost)) {
          simulated[toInventoryKey(subIng)] =
            (simulated[toInventoryKey(subIng)] ?? 0) - subAmount
        }
        for (const [outKey, outAmount] of Object.entries(subRecipe.output)) {
          simulated[toInventoryKey(outKey)] =
            (simulated[toInventoryKey(outKey)] ?? 0) + outAmount
        }
        plan.push(subRecipeName)
      }
    }

    visiting.delete(recipeName)
    return true
  }

  if (!ensureFor(targetRecipeName)) return null

  // Subtract the target's own cost from simulated, then verify the target
  // is now fully covered.
  const targetCost = normalizeIngredients(target.ingredients)
  for (const [ing, amount] of Object.entries(targetCost)) {
    const key = toInventoryKey(ing)
    if (getSim(key) < amount) return null
  }
  plan.push(targetRecipeName)
  return plan
}

export function startCraft(recipeName: string): boolean {
  if (canCraft(recipeName)) return enqueueCraft(recipeName)

  const plan = buildPrerequisitePlan(recipeName)
  if (!plan) return false

  for (const step of plan) {
    if (!enqueueCraft(step)) return false
  }
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
