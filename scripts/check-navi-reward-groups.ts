import assert from "node:assert/strict"
import { normalizeStructTag } from "@mysten/sui/utils"

import { groupNaviRewardCoins } from "../src/hooks/claim/navi-reward-groups.ts"

const navx = "0xa::navx::NAVX"
const sui = "0x2::sui::SUI"
const groups = groupNaviRewardCoins(
  [
    { coin: "navx-1", coinType: navx },
    { coin: "navx-2", coinType: navx },
    { coin: "sui-1", coinType: sui },
  ],
  [
    { amount: 1.25, coinType: navx },
    { amount: 2.75, coinType: navx },
    { amount: 3, coinType: sui },
  ]
)

assert.deepEqual(groups, [
  {
    amount: 4,
    coins: ["navx-1", "navx-2"],
    coinType: normalizeStructTag(navx),
  },
  {
    amount: 3,
    coins: ["sui-1"],
    coinType: normalizeStructTag(sui),
  },
])

console.log("Navi reward grouping check passed.")
