export type Direction = 'up' | 'right' | 'down' | 'left'

export type BuildingType =
  | 'burner_drill'
  | 'wooden_chest'
  | 'transport_belt'
  | 'stone_furnace'
  | 'burner_inserter'

export type BuildSelection = BuildingType | null

export type ItemType =
  | 'iron_ore'
  | 'copper_ore'
  | 'stone'
  | 'coal'
  | 'wood'
  | 'iron_plate'
  | 'copper_plate'
  | 'stone_brick'

export interface BurnerDrill {
  type: 'burner_drill'
  tileX: number
  tileY: number
  direction: Direction
  fuel: number
  progress: number
  outputItem: ItemType | null
  outputCount: number
  outputCapacity: number
}

export interface WoodenChest {
  type: 'wooden_chest'
  tileX: number
  tileY: number
  item: ItemType | null
  count: number
  capacity: number
}

export interface TransportBelt {
  type: 'transport_belt'
  tileX: number
  tileY: number
  direction: Direction
  item: ItemType | null
  itemProgress: number
}

export interface StoneFurnace {
  type: 'stone_furnace'
  tileX: number
  tileY: number
  fuel: number
  progress: number
  inputItem: ItemType | null
  inputCount: number
  inputCapacity: number
  outputItem: ItemType | null
  outputCount: number
  outputCapacity: number
}

export interface BurnerInserter {
  type: 'burner_inserter'
  tileX: number
  tileY: number
  direction: Direction
  fuel: number
  progress: number
  heldItem: ItemType | null
}

export type Building =
  | BurnerDrill
  | WoodenChest
  | TransportBelt
  | StoneFurnace
  | BurnerInserter

export type Buildings = Building[]