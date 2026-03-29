export interface InventoryStack {
    item: string
    count: number
  }
  
  export const inventory: InventoryStack[] = []
  
  export function addItem(item: string, count: number = 1) {
    const existing = inventory.find(stack => stack.item === item)
  
    if (existing) {
      existing.count += count
    } else {
      inventory.push({ item, count })
    }
  }