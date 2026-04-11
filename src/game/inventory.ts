export interface InventoryStack {
  item: string
  count: number
}

export const inventory: InventoryStack[] = []

export const inventoryUi = {
  open: false,
}

export function addItem(item: string, count: number = 1) {
  const existing = inventory.find((stack) => stack.item === item)

  if (existing) {
    existing.count += count
  } else {
    inventory.push({ item, count })
  }
}

export function getItemCount(item: string) {
  return inventory.find((stack) => stack.item === item)?.count ?? 0
}

export function removeItem(item: string, count: number = 1) {
  const existing = inventory.find((stack) => stack.item === item)

  if (!existing || existing.count < count) {
    return false
  }

  existing.count -= count

  if (existing.count <= 0) {
    const index = inventory.indexOf(existing)
    inventory.splice(index, 1)
  }

  return true
}

export function toggleInventoryUi() {
  inventoryUi.open = !inventoryUi.open
}

export function closeInventoryUi() {
  inventoryUi.open = false
}

export function isInventoryUiOpen() {
  return inventoryUi.open
}