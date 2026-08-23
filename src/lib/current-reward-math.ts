export type CurrentPoolReward = {
  coin_type?: string
  cumulative_rewards_per_share?: { value?: string }
  end_time_ms?: string
  start_time_ms?: string
  total_rewards?: string
}

export type CurrentRewardManager = {
  earned_rewards?: { value?: string }
  cumulative_rewards_per_share?: { value?: string }
}

const WAD = 1_000_000_000_000_000_000n

export function calculateCurrentClaimable(
  poolReward: CurrentPoolReward,
  obligationReward: CurrentRewardManager | null,
  obligationShare: bigint,
  totalShares: bigint,
  poolLastUpdate: bigint,
  obligationLastUpdate: bigint,
  now: bigint
) {
  if (obligationShare === 0n || totalShares === 0n) return 0n

  const start = BigInt(poolReward.start_time_ms ?? 0)
  const end = BigInt(poolReward.end_time_ms ?? 0)
  let cumulative = BigInt(poolReward.cumulative_rewards_per_share?.value ?? 0)
  if (end > start && now > poolLastUpdate) {
    const rewardStart = start > poolLastUpdate ? start : poolLastUpdate
    const rewardEnd = end < now ? end : now
    if (rewardEnd > rewardStart) {
      const unlocked = BigInt(poolReward.total_rewards ?? 0)
        * (rewardEnd - rewardStart) * WAD / (end - start)
      cumulative += unlocked / totalShares
    }
  }

  let previous = cumulative
  let earned = 0n
  if (obligationReward) {
    previous = BigInt(
      obligationReward.cumulative_rewards_per_share?.value ?? 0
    )
    earned = BigInt(obligationReward.earned_rewards?.value ?? 0)
  } else if (obligationLastUpdate <= start) {
    earned = cumulative * obligationShare
  }

  return (earned + (cumulative - previous) * obligationShare) / WAD
}
