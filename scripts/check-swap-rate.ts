import assert from "node:assert/strict"

import { formatSwapRate } from "../src/lib/swap-rate.ts"

assert.equal(formatSwapRate("20.155810595", "16.690513"), "0.828")
assert.equal(formatSwapRate("0", "16.690513"), null)

console.log("Swap rate check passed.")
