// Alt-mode is a global UI toggle that asks every renderer to paint big
// item-icon overlays on belts / chests / inserters / etc. Lives in its own
// module so building draw code can read it without depending on the loop
// state module (which depends on buildings types).

let altMode = false

export function isAltMode() {
  return altMode
}

export function setAltMode(value: boolean) {
  altMode = value
}

export function toggleAltMode() {
  altMode = !altMode
}