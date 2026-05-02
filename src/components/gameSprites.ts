// Vite eagerly inlines every PNG in ./sprites/ as a hashed asset URL at build
// time. The cache key is the filename without the extension (e.g. iron_ore.png
// -> 'iron_ore'), matching the keys used by the fetcher script and the
// in-game item / building type strings.

const spriteUrls = import.meta.glob<string>('./sprites/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
})

const spriteCache = new Map<string, HTMLImageElement>()
let loaded = false

function keyFromPath(path: string) {
  const file = path.split('/').pop() ?? path
  return file.replace(/\.png$/i, '')
}

export function loadGameSprites() {
  if (loaded) return
  loaded = true

  for (const [path, url] of Object.entries(spriteUrls)) {
    const key = keyFromPath(path)
    const img = new Image()
    img.src = url
    spriteCache.set(key, img)
  }
}

export function getGameSprite(name: string) {
  return spriteCache.get(name) ?? null
}

export function isSpriteReady(img: HTMLImageElement | null): img is HTMLImageElement {
  return !!img && img.complete && img.naturalWidth > 0
}
