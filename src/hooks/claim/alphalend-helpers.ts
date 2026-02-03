import type { SuiClient } from "@mysten/sui/client"
import type { AlphalendClient } from "@alphafi/alphalend-sdk"

export async function getAlphaLendPositionId(
  client: SuiClient,
  constants: AlphalendClient["constants"],
  address: string
) {
  const response = await client.getOwnedObjects({
    owner: address,
    options: { showContent: true },
    filter: { StructType: constants.POSITION_CAP_TYPE },
  })
  const cap = response.data[0]?.data as
    | { content?: { fields?: { position_id?: string } } }
    | undefined
  return cap?.content?.fields?.position_id ?? null
}

export async function getAlphaLendRewardInput(
  client: SuiClient,
  constants: AlphalendClient["constants"],
  address: string
) {
  type RewardDistributorEntry = {
    fields: {
      market_id: string
      is_deposit: boolean
      last_updated: string
      share: string
      rewards: Array<{
        fields?: {
          earned_rewards?: { fields?: { value?: string } }
          cummulative_rewards_per_share?: { fields?: { value?: string } }
        }
      }>
    }
  }
  type PositionFields = {
    reward_distributors?: RewardDistributorEntry[]
  }
  type MarketReward = {
    fields: {
      coin_type: { fields: { name: string } }
      end_time: string
      start_time: string
      cummulative_rewards_per_share: { fields: { value: string } }
    }
  }
  type MarketRewardDistributor = {
    rewards: MarketReward[]
  }
  type MarketFields = {
    deposit_reward_distributor?: { fields?: MarketRewardDistributor }
    borrow_reward_distributor?: { fields?: MarketRewardDistributor }
  }

  const positionId = await getAlphaLendPositionId(client, constants, address)
  if (!positionId) return []
  const position = await client.getDynamicFieldObject({
    parentId: constants.POSITION_TABLE_ID,
    name: {
      type: "0x2::object::ID",
      value: positionId,
    },
  })
  const positionFields = (position.data as {
    content?: { fields?: { value?: { fields?: PositionFields } } }
  })?.content?.fields?.value?.fields
  const rewardDistributors = positionFields?.reward_distributors ?? []
  const rewardInput: { marketId: number; coinTypes: string[] }[] = []
  const marketActionMap: Map<number, string[]> = new Map()

  const getRewardDistributor = async (
    marketId: number,
    isDeposit: boolean
  ) => {
    const market = await client.getDynamicFieldObject({
      parentId: constants.MARKETS_TABLE_ID,
      name: {
        type: "u64",
        value: marketId.toString(),
      },
    })
    const marketFields = (market.data as {
      content?: { fields?: { value?: { fields?: MarketFields } } }
    })?.content?.fields?.value?.fields
    if (!marketFields) return null
    return isDeposit
      ? marketFields.deposit_reward_distributor?.fields
      : marketFields.borrow_reward_distributor?.fields
  }

  for (const rewardDistributor of rewardDistributors) {
    const marketId = Number(rewardDistributor.fields.market_id)
    const coinTypes: Set<string> = new Set(marketActionMap.get(marketId) || [])
    const lastUpdated = rewardDistributor.fields.last_updated
    const marketRewardDistributorObj = await getRewardDistributor(
      marketId,
      rewardDistributor.fields.is_deposit
    )
    const userRewardDistributorObj = rewardDistributor.fields.rewards
    if (!marketRewardDistributorObj) continue

    for (let i = 0; i < marketRewardDistributorObj.rewards.length; i += 1) {
      const marketReward = marketRewardDistributorObj.rewards[i]
      if (!marketReward) continue
      const userReward =
        i < userRewardDistributorObj.length
          ? userRewardDistributorObj[i]
          : null

      const timeElapsed =
        Math.min(Number(marketReward.fields.end_time), Date.now())
        - Math.max(Number(marketReward.fields.start_time), Number(lastUpdated))

      const userRewardFields = userReward?.fields
      const share = Number(rewardDistributor.fields.share)

      if (timeElapsed > 0 && share > 0) {
        coinTypes.add(marketReward.fields.coin_type.fields.name)
      } else if (userReward && userRewardFields) {
        const earnedValue = Number(
          userRewardFields?.earned_rewards?.fields?.value ?? 0
        )
        if (earnedValue !== 0) {
          coinTypes.add(marketReward.fields.coin_type.fields.name)
        } else if (
          Number(marketReward.fields.cummulative_rewards_per_share.fields.value)
            > Number(
              userRewardFields?.cummulative_rewards_per_share?.fields?.value ?? 0
            )
          && share > 0
        ) {
          coinTypes.add(marketReward.fields.coin_type.fields.name)
        }
      } else if (
        share > 0
        && Number(marketReward.fields.cummulative_rewards_per_share.fields.value) > 0
      ) {
        coinTypes.add(marketReward.fields.coin_type.fields.name)
      }
    }
    marketActionMap.set(marketId, [...coinTypes])
  }

  for (const [marketId, coinTypes] of marketActionMap.entries()) {
    rewardInput.push({ marketId, coinTypes })
  }

  return rewardInput
}
