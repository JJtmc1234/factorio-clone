export type WorldObjectType = 'tree' | 'iron_ore' | 'copper_ore' | 'stone' | 'coal'

export type Biome = 'dirt' | 'grass' | 'grass_lush'

export interface WorldObject {
  type: WorldObjectType
  amount: number
}

export interface Tile {
  object: WorldObject | null
  biome: Biome
}

export interface Chunk {
  chunkX: number
  chunkY: number
  tiles: Tile[][]
}

export const TILE_SIZE = 32
export const CHUNK_SIZE = 32
