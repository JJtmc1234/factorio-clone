import type { ItemType } from './types'

export function isMineableResource(type: string | undefined): type is ItemType {
  return type === 'iron_ore' || type === 'copper_ore' || type === 'stone' || type === 'coal'
}

export function isSmeltableInput(item: ItemType | null): item is 'iron_ore' | 'copper_ore' | 'stone' {
  return item === 'iron_ore' || item === 'copper_ore' || item === 'stone'
}

export function getItemDrawColor(item: ItemType | null) {
  if (item === 'coal') return '#1a1a1d'
  if (item === 'iron_ore') return '#c0c6cf'
  if (item === 'copper_ore') return '#b87333'
  if (item === 'stone') return '#8f8f8f'
  if (item === 'wood') return '#8b5a2b'
  if (item === 'iron_plate') return '#d9dee6'
  if (item === 'copper_plate') return '#d08a45'
  if (item === 'stone_brick') return '#b8b8b8'
  return '#ffffff'
}

export function getSmeltingResult(item: ItemType | null): ItemType | null {
  if (item === 'iron_ore') return 'iron_plate'
  if (item === 'copper_ore') return 'copper_plate'
  if (item === 'stone') return 'stone_brick'
  return null
}

export function getFuelValue(item: ItemType) {
  if (item === 'coal') return 8
  if (item === 'wood') return 5
  return 0
}

export function canBurnerConsumeItem(item: ItemType) {
  return item === 'coal' || item === 'wood'
}

export function isGroundBlockingObject(type: string | undefined) {
  return type === 'tree'
}