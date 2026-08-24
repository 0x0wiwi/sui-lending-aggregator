import BigNumber from "bignumber.js"
import { RATE_DECIMAL_PLACES } from "./format-number.ts"

export function formatSwapRate(amountIn: string, amountOut: string) {
  const input = new BigNumber(amountIn.replace(/,/g, ""))
  const output = new BigNumber(amountOut.replace(/,/g, ""))

  if (!input.isFinite() || !output.isFinite() || input.lte(0) || output.lt(0)) {
    return null
  }

  return output
    .dividedBy(input)
    .toFixed(RATE_DECIMAL_PLACES, BigNumber.ROUND_FLOOR)
}
