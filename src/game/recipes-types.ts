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
