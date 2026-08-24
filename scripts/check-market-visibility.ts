import assert from "node:assert/strict"

import { isScallopMarketSupplyAvailable } from "../src/lib/scallop-market-visibility.ts"

const available = { coinName: "sui", supplyCoin: 1, maxSupplyCoin: 2 }
const deprecated = { coinName: "blub", supplyCoin: 1, maxSupplyCoin: 2 }

assert.equal(isScallopMarketSupplyAvailable(available, new Set(), false), true)
assert.equal(isScallopMarketSupplyAvailable(deprecated, new Set(), true), false)
assert.equal(
  isScallopMarketSupplyAvailable(available, new Set(["sui"]), false),
  false
)
assert.equal(
  isScallopMarketSupplyAvailable(
    { ...available, supplyCoin: 2 },
    new Set(),
    false
  ),
  false
)

console.log("Market visibility check passed.")
