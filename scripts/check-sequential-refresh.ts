import assert from "node:assert/strict"

import { runSequentialRefresh } from "../src/lib/sequential-refresh.ts"

const order: string[] = []
await runSequentialRefresh(["Current", "Scallop", "Navi"], async (protocol) => {
  order.push(protocol)
})
assert.deepEqual(order, ["Current", "Scallop", "Navi"])

await runSequentialRefresh(["Suilend", "AlphaLend"], async (protocol) => {
  order.push(protocol)
  return false
})
assert.equal(order.at(-1), "Suilend")

console.log("Sequential refresh check passed.")
