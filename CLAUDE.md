# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Vite dev server with HMR.
- `npm run build` — type-checks (`vue-tsc -b`) then bundles via Vite. Type errors fail the build.
- `npm run preview` — serve the built `dist/` locally.

There is no test runner, linter, or formatter configured. `vue-tsc` during `build` is the only static check.

Vite is configured with `base: '/factorio-clone/'` (vite.config.ts) for GitHub Pages. Asset URLs use `new URL('./asset.png', import.meta.url)` so they resolve correctly under that base — keep this pattern when adding new sprites (see `src/components/gameSprites.ts`).

## Architecture

The Vue layer is a thin shell. `App.vue` mounts `GameView.vue`, which owns a single `<canvas>` and hands its 2D context to `startGame()` in `src/game/loop.ts`. Pinia is installed in `main.ts` but the game does not use Vue reactivity — everything is plain TS modules. Treat `src/game/**` as a self-contained imperative game; don't reach for refs/computed/stores when adding gameplay.

### Game loop (`src/game/loop/*`)

`requestAnimationFrame` drives `update(dt) → render()`. `dt` is clamped to 50ms. Render order: terrain → grid → world objects → buildings → world-overlay (hover/mining) → player → HUD. The map overlay (`map.ts`) short-circuits rendering when open.

Loop is split into focused files; import `startGame` from `../game/loop` (resolves to `loop/index.ts`):

- `loop/core.ts` — `startGame`, `resizeCanvas`, the RAF tick, the `render()` dispatcher. Owns the local `canvas`/`ctx` references; passes them as args into the draw helpers. HMR-safe: each call rebinds canvas/ctx so a re-mounted `<GameView>` keeps drawing.
- `loop/state.ts` — shared mutable `state` (`selectedBuild`, `openedBuilding`, `buildDirection`) and the `rotateDirection` helper. Imported by `update.ts`, `overlay.ts`, and `hud/*`.
- `loop/update.ts` — per-frame input handling: keyboard hotkeys, build placement, mining, and the `updateBuildings(dt)` call.
- `loop/terrain.ts` — `drawTerrain` (biome colors), `drawGrid`, `drawObjects` (per-resource tile sprites).
- `loop/player.ts` — `drawPlayer` and the canvas fallback sprite.
- `loop/overlay.ts` — world-space overlays: `drawHoverAndGhost` (cursor + ghost + tooltip) and `drawMiningProgress`.
- `loop/hud/*` — screen-space UI: `build-bar.ts`, `inventory.ts` (compact + full menu), `building-panel.ts`. `hud/index.ts` re-exports.

Adding a new render pass means putting it in the right file and wiring its call into `core.ts render()`.

### State lives in module singletons, not stores

Each subsystem exports a mutable singleton plus functions that mutate it:

- `player.ts` — `player` position/size, `updatePlayer(dt, keys)`.
- `camera.ts` — `camera` rect, plus `worldToScreen` / `screenToWorld`.
- `input.ts` — `input.keys` (held) and `input.pressed` (edge-triggered). Use `consumePressed('x')` for one-shot actions; it clears the flag.
- `mouse.ts` — `mouse.x/y/leftDown`, plus `consumeRightPressed()` (edge-triggered) for placement.
- `inventory.ts` — flat `InventoryStack[]`; items keyed by string. `inventoryUi.open` toggles the inventory overlay.
- `mining.ts` — manual mining state machine (left-mouse on a resource tile not occupied by a building).
- `world/*` — chunked tilemap (see "World generation" below).

This means subsystems read each other's state directly (e.g. `mining.ts` imports `mouse` and the world). Preserve that style rather than introducing event buses or stores.

### World generation (`src/game/world/*`)

The world is infinite and chunked (`CHUNK_SIZE = 32`, `TILE_SIZE = 32`). Chunks are generated on demand and cached. Import everything from `../game/world` (resolves to `world/index.ts`).

- `world/types.ts` — `Tile`, `WorldObject`, `Biome`, `Chunk` and the `TILE_SIZE`/`CHUNK_SIZE` constants.
- `world/keys.ts` — `getChunkKey` / `getTileKey` / `worldToChunkCoord` / `mod` (used by chunks and visibility).
- `world/noise.ts` — `hash`, `fbm`, `biomeForTile`, `treePlacementChance`. All world generation noise lives here, with seed/scale constants. Tweak biome thresholds and tree spawn chances here.
- `world/generation.ts` — `generateChunk` (called once per chunk by `getOrCreateChunk`). It paints biome + trees from noise, then four guaranteed starter resource patches near spawn (iron, coal, copper, stone), then 3×3-chunk-window random patches. `paintPatch` uses noise-distorted boundaries and `(minAmount, maxAmount)` per-tile amounts so patches are organic blobs with realistic ore totals (~300k+).
- `world/chunks.ts` — chunk cache + `getOrCreateChunk`, `getTileAtWorldTile`, screen-position lookups.
- `world/visibility.ts` — Factorio-style chunk charting. `chartedChunks` (per-chunk Set, used by the M map) and `visibleTiles` (current FOV, recomputed each frame). `updateVisibility` charts every chunk the player vision touches; `chartStarterArea` charts a square of chunks around spawn at game start. **In-world renderers do not gate on charting** — you see everything in the camera bounds. Only `map.ts` checks `isChunkCharted` so uncharted chunks stay dark on the M overlay.

### Buildings subsystem (`src/game/buildings/*`)

`src/game/buildings.ts` is a one-line re-export shim of `src/game/buildings/index.ts` — import from `./buildings` from outside the folder, but inside the folder import siblings directly to avoid cycles.

File responsibilities:

- `types.ts` — `Direction`, `BuildingType`, `ItemType`, the per-building interfaces, and the `Building` discriminated union. All other files key off `building.type`.
- `store.ts` — owns the `buildings: Building[]` array via `getAllBuildings()` (returns the mutable reference) and `addBuilding(b)`. Anything that needs to splice/iterate goes through here.
- `place.ts` — `canPlaceBuilding`, the per-type `placeXxx`, the dispatcher `placeBuilding`, and `removeBuildingAtTile` (which spills inventory items back to the player on deconstruct).
- `interact.ts` — player ↔ building interactions: `fuelBuildingAtTile`, `storeOneCoalInBuilding`, `takeOneFromBuilding`.
- `update.ts` — `updateBuildings(dt)`: per-frame tick that fans out to each building type's own update.
- `tile.ts` — tile-occupancy queries (1×1 vs 2×2 footprints) and the **generic item-routing API**: `canBuildingAcceptItem`, `tryInsertIntoBuilding`, `takeOneItemFromBuildingInternal`. Inserters and other transports go through these rather than knowing about each target type.
- `items.ts` — pure item taxonomy (mineable, smeltable, fuel value, smelting result, draw color).
- `render.ts` — `renderBuildings(ctx)` (the only render entry point used by the loop) — dispatches to each `drawXxxSprite`.
- `ghost.ts` — `renderBuildingGhost` for the placement preview, dispatching to each `drawFallbackXxxSprite`.
- `tooltip.ts` — `getBuildingTooltipLines(building)`.
- `draw-helpers.ts` — `drawDirectionMarker`, `drawSpriteRotated`. Imported by per-building draw code.
- `drill.ts` / `furnace.ts` / `chest.ts` / `belts.ts` / `inserter.ts` — per-building data, update tick, push/pull helpers, sprite + fallback canvas drawing. 2×2 buildings (drill, furnace) anchor at top-left and cover `tileX..tileX+1, tileY..tileY+1`.

When adding a new building:
1. Add it to `BuildingType` and the `Building` union in `types.ts`.
2. Create a new `buildings/<name>.ts` exporting `create…`, `update…`, drawing functions, and any push/pull helpers.
3. Re-export from `buildings/index.ts`.
4. Wire placement validation in `canPlaceBuilding` (`place.ts`) and add a `placeXxx` + dispatcher case. Add removal cleanup in `removeBuildingAtTile` (`place.ts`) if the building stores items. Add its update pass in `updateBuildings` (`update.ts`).
5. Add tile-routing branches to `canBuildingAcceptItem` / `tryInsertIntoBuilding` / `takeOneItemFromBuildingInternal` in `tile.ts` if it participates in item flow.
6. Add a render branch in `renderBuildings` (`render.ts`) and a ghost branch in `renderBuildingGhost` (`ghost.ts`).
7. Add a tooltip case in `getBuildingTooltipLines` (`tooltip.ts`) and a panel case in `loop/hud/building-panel.ts`.
8. Wire keyboard selection and the `placeXxx` call in `loop/update.ts`.

### Sprites and fallbacks

`src/components/gameSprites.ts` lazy-loads PNGs co-located in `src/components/` into a `Map`. Every drawing function checks `sprite && sprite.complete && sprite.naturalWidth > 0` and falls back to a canvas-drawn placeholder (`drawFallback…Sprite`). Always provide both paths when adding a building so the game stays playable while the image is still loading or missing.

### Input conventions

- Edge-triggered keys (build selection, toggles, one-shot actions) use `consumePressed('key')` from `input.ts`.
- Held keys (movement) read `input.keys` directly in `updatePlayer`.
- Right-click placement uses `consumeRightPressed()` from `mouse.ts`; left-click held drives mining.
- Current bindings live in `loop/update.ts`: `1–5` select buildables, `r` rotates, right-click places, `e` opens, `f` fuels/loads coal, `g` takes one, `x` deconstructs, `tab`/`i` inventory, `m` map, `escape` cancels.

### File size convention

Per repo convention (see commit `aedc4f3` and follow-ups): files past ~150 lines should be split into a folder of cohesive subfiles with an `index.ts` re-export, so existing imports keep working. Don't split files that have a single tight responsibility just because they're long (e.g. `recipes.ts` is a flat data table, per-building files like `drill.ts`/`furnace.ts` are one entity each).
