// Display formatters used by the UI. Item/recipe identifiers in the codebase
// use kebab-case (recipes) or snake_case (inventory keys); the human-facing
// label is Title-cased with spaces. Keep this conversion in one place so
// every panel renders the same string for "iron-plate" / "iron_plate" /
// "burner-mining-drill".

export function formatItemName(key: string): string {
  if (!key) return key
  const spaced = key.replace(/[-_]/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
}
