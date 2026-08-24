import assert from "node:assert/strict"

import {
  formatFloorFixed,
  formatTokenAmount,
} from "../src/lib/format-number.ts"

assert.equal(formatFloorFixed(10.2199, 3), "10.219")
assert.equal(formatFloorFixed(0.000009, 3), "0.000")
assert.equal(formatFloorFixed(Number.NaN, 3), null)
assert.equal(formatTokenAmount("151778.241241"), "151,778.24124")
assert.equal(formatTokenAmount("0.000009"), "0.00000")

console.log("Display format check passed.")
