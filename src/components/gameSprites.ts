const spriteCache = new Map<string, HTMLImageElement>()
let loaded = false

function loadImage(src: string) {
  const img = new Image()
  img.src = src
  return img
}

export function loadGameSprites() {
  if (loaded) return
  loaded = true

  const playerUrl = new URL('./48px-Player.png', import.meta.url).href
  const chestUrl = new URL('./48px-Wooden_chest.png', import.meta.url).href
  const burnerDrillUrl = new URL('./Burner_mining_drill.png', import.meta.url).href

  spriteCache.set('player', loadImage(playerUrl))
  spriteCache.set('wooden_chest', loadImage(chestUrl))
  spriteCache.set('burner_drill', loadImage(burnerDrillUrl))
}

export function getGameSprite(name: string) {
  return spriteCache.get(name) ?? null
}