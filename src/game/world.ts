export type WorldObjectType = 'tree' | 'ore'

export interface Tile {
  object: WorldObjectType | null
}

export interface World {
  width: number
  height: number
  tileSize: number
  tiles: Tile[][]
}

function createWorld(width: number, height: number, tileSize: number): World {
  const tiles: Tile[][] = []

  for (let y = 0; y < height; y++) {
    const row: Tile[] = []

    for (let x = 0; x < width; x++) {
      row.push({ object: null })
    }

    tiles.push(row)
  }

  // temporary test objects
  tiles[5][5].object = 'tree'
  tiles[8][12].object = 'tree'
  tiles[10][15].object = 'ore'
  tiles[12][20].object = 'ore'

  return {
    width,
    height,
    tileSize,
    tiles
  }
}

export const world: World = createWorld(50, 30, 32)

export function getTileAtScreenPosition(screenX: number, screenY: number) {
  const tileX = Math.floor(screenX / world.tileSize)
  const tileY = Math.floor(screenY / world.tileSize)

  if (
    tileX < 0 ||
    tileY < 0 ||
    tileX >= world.width ||
    tileY >= world.height
  ) {
    return null
  }

  return {
    tileX,
    tileY,
    tile: world.tiles[tileY][tileX]
  }
}