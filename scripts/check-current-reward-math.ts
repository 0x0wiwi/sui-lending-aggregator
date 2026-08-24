import assert from "node:assert/strict"

import {
  isCurrentMarketListed,
  isCurrentMarketSupplyAvailable,
} from "../src/lib/current-market-visibility.ts"
import { calculateCurrentClaimable } from "../src/lib/current-reward-math.ts"

const WAD = 1_000_000_000_000_000_000n

assert.equal(
  calculateCurrentClaimable(
    {
      cumulative_rewards_per_share: { value: "0" },
      start_time_ms: "0",
      end_time_ms: "100",
      total_rewards: "1000",
    },
    null,
    2n,
    10n,
    0n,
    0n,
    50n
  ),
  100n
)

assert.equal(
  calculateCurrentClaimable(
    { cumulative_rewards_per_share: { value: (20n * WAD).toString() } },
    {
      cumulative_rewards_per_share: { value: (10n * WAD).toString() },
      earned_rewards: { value: (3n * WAD).toString() },
    },
    2n,
    10n,
    0n,
    0n,
    0n
  ),
  23n
)

assert.equal(isCurrentMarketListed({}), true)
assert.equal(isCurrentMarketListed({ hidden: true }), false)
assert.equal(isCurrentMarketListed({ labelGroup: ["others", "1"] }), false)
assert.equal(isCurrentMarketSupplyAvailable({ borrowPaused: true }), true)
assert.equal(isCurrentMarketSupplyAvailable({ supplyPaused: true }), false)

console.log("Current checks passed.")
