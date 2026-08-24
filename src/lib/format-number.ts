import BigNumber from "bignumber.js"

export const RATE_DECIMAL_PLACES = 3
export const TOKEN_AMOUNT_DECIMAL_PLACES = 5

export function formatFloorFixed(value: BigNumber.Value, digits: number) {
  const number = new BigNumber(value)
  if (!number.isFinite()) return null
  return number.toFixed(digits, BigNumber.ROUND_FLOOR)
}

export function formatTokenAmount(value: BigNumber.Value) {
  const fixed = formatFloorFixed(value, TOKEN_AMOUNT_DECIMAL_PLACES)
  if (!fixed) return "—"
  const [whole, fraction] = fixed.split(".")
  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return `${groupedWhole}.${fraction}`
}
