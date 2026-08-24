import BigNumber from "bignumber.js"

export function formatSwapRate(amountIn: string, amountOut: string) {
  const input = new BigNumber(amountIn.replace(/,/g, ""))
  const output = new BigNumber(amountOut.replace(/,/g, ""))

  if (!input.isFinite() || !output.isFinite() || input.lte(0) || output.lt(0)) {
    return null
  }

  return output.dividedBy(input).toFixed(3, BigNumber.ROUND_FLOOR)
}
