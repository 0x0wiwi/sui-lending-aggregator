import { normalizeStructTag } from "@mysten/sui/utils"

export function groupNaviRewardCoins<T>(
  claimed: Array<{ coin: T; coinType: string }>,
  rewards: Array<{ amount: number; coinType: string }>
) {
  const amounts = new Map<string, number>()
  rewards.forEach(({ amount, coinType }) => {
    const key = normalizeStructTag(coinType)
    amounts.set(key, (amounts.get(key) ?? 0) + amount)
  })

  const groups = new Map<string, { coinType: string; coins: T[] }>()
  claimed.forEach(({ coin, coinType }) => {
    const key = normalizeStructTag(coinType)
    const group = groups.get(key)
    if (group) {
      group.coins.push(coin)
    } else {
      groups.set(key, { coinType: key, coins: [coin] })
    }
  })

  return Array.from(groups, ([key, group]) => ({
    ...group,
    amount: amounts.get(key) ?? 0,
  }))
}
