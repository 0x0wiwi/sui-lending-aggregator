import type { AlphalendClient } from "@alphafi/alphalend-sdk"

type AlphaLendBlockchain = AlphalendClient["blockchain"]

type AlphaLendUserReward = {
  earnedRewards: string
  cummulativeRewardsPerShare: string
}

type AlphaLendUserRewardDistributor = {
  marketId: string
  isDeposit: boolean
  lastUpdated: string
  share: string
  rewards: AlphaLendUserReward[]
}

type AlphaLendMarketReward = {
  coinType: string
  endTime: string
  startTime: string
  cummulativeRewardsPerShare: string
}

type AlphaLendMarketRewardDistributor = {
  rewards: AlphaLendMarketReward[]
}

type AlphaLendPosition = {
  rewardDistributors: AlphaLendUserRewardDistributor[]
}

type AlphaLendPositionCap = {
  id: string
  positionId: string
}

type AlphaLendMarket = {
  depositRewardDistributor?: AlphaLendMarketRewardDistributor
  borrowRewardDistributor?: AlphaLendMarketRewardDistributor
}

function addClaimableCoinTypes(
  userDistributor: AlphaLendUserRewardDistributor,
  marketDistributor: AlphaLendMarketRewardDistributor,
  coinTypes: Set<string>
) {
  const lastUpdated = Number(userDistributor.lastUpdated)
  const share = Number(userDistributor.share)

  for (let i = 0; i < marketDistributor.rewards.length; i += 1) {
    const marketReward = marketDistributor.rewards[i]
    if (!marketReward) continue
    const userReward =
      i < userDistributor.rewards.length ? userDistributor.rewards[i] : null
    const timeElapsed =
      Math.min(Number(marketReward.endTime), Date.now())
      - Math.max(Number(marketReward.startTime), lastUpdated)

    if (timeElapsed > 0 && share > 0) {
      coinTypes.add(marketReward.coinType)
      continue
    }

    if (userReward) {
      if (Number(userReward.earnedRewards) !== 0) {
        coinTypes.add(marketReward.coinType)
      } else if (
        Number(marketReward.cummulativeRewardsPerShare)
          > Number(userReward.cummulativeRewardsPerShare)
        && share > 0
      ) {
        coinTypes.add(marketReward.coinType)
      }
    } else if (
      share > 0
      && Number(marketReward.cummulativeRewardsPerShare) > 0
    ) {
      coinTypes.add(marketReward.coinType)
    }
  }
}

export async function getAlphaLendRewardInput(
  blockchain: AlphaLendBlockchain,
  address: string
) {
  const positionCaps = await blockchain.getPositionCapsForUser(address) as
    AlphaLendPositionCap[]
  if (!positionCaps.length) return []

  const rewardInput: Array<{
    positionCapId: string
    marketId: number
    coinTypes: string[]
  }> = []

  for (const positionCap of positionCaps) {
    const position = await blockchain.getPosition(
      positionCap.positionId
    ) as AlphaLendPosition
    const marketActionMap = new Map<number, string[]>()

    for (const rewardDistributor of position.rewardDistributors) {
      const marketId = Number(rewardDistributor.marketId)
      const coinTypes = new Set(marketActionMap.get(marketId) ?? [])
      const market = await blockchain.getMarket(marketId) as AlphaLendMarket
      const marketRewardDistributor = rewardDistributor.isDeposit
        ? market.depositRewardDistributor
        : market.borrowRewardDistributor
      if (!marketRewardDistributor) continue

      addClaimableCoinTypes(
        rewardDistributor,
        marketRewardDistributor,
        coinTypes
      )
      marketActionMap.set(marketId, [...coinTypes])
    }

    for (const [marketId, coinTypes] of marketActionMap.entries()) {
      rewardInput.push({
        positionCapId: positionCap.id,
        marketId,
        coinTypes,
      })
    }
  }

  return rewardInput
}
