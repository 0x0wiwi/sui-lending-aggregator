import type { TransactionObjectArgument } from "@mysten/sui/transactions"
import { Transaction } from "@mysten/sui/transactions"
import BN from "bn.js"
import {
  claimLendingRewardsPTB,
  getUserAvailableLendingRewards,
} from "@naviprotocol/lending"
import { ScallopBuilder } from "@scallop-io/sui-scallop-sdk"
import {
  LENDING_MARKET_ID,
  LENDING_MARKET_TYPE,
  SuilendClient,
} from "@suilend/sdk/client"
import { PACKAGE_ID } from "@suilend/sdk/_generated/suilend"

import type { Protocol, RewardSummaryItem } from "@/lib/market-data"
import type { SuiLegacyClientAdapter } from "@/lib/sui-client"
import { buildRewardAmountMap } from "@/hooks/claim/swap-helpers"

export type ClaimInput = {
  coinType: string
  coin: TransactionObjectArgument
  amountAtomic: BN | null
}

export type ClaimResult = {
  inputs: ClaimInput[]
  hasClaim: boolean
}

type ClaimBuilderDeps = {
  accountAddress?: string
  suiClient: SuiLegacyClientAdapter
  getRewardsForProtocol: (protocol: Protocol) => RewardSummaryItem["rewards"]
  hasSuilendClaim: boolean
  suilendClaimRewards: NonNullable<
    NonNullable<RewardSummaryItem["claimMeta"]>["suilend"]
  >["rewards"]
  toAtomicAmount: (amount: number, coinType: string) => BN | null
}

type SuilendRpcClient = Parameters<typeof SuilendClient.initialize>[2]

export function createClaimBuilders({
  accountAddress,
  suiClient,
  getRewardsForProtocol,
  hasSuilendClaim,
  suilendClaimRewards,
  toAtomicAmount,
}: ClaimBuilderDeps) {
  const appendSuilendClaim = async (tx: Transaction): Promise<ClaimResult> => {
    if (!accountAddress) return { inputs: [], hasClaim: false }
    if (!hasSuilendClaim) return { inputs: [], hasClaim: false }
    const suilendClient = await SuilendClient.initialize(
      LENDING_MARKET_ID,
      LENDING_MARKET_TYPE,
      suiClient as unknown as SuilendRpcClient
    )
    const ownerCaps = await suiClient.getOwnedObjects({
      owner: accountAddress,
      filter: {
        StructType: `${PACKAGE_ID}::lending_market::ObligationOwnerCap<${suilendClient.lendingMarket.$typeArgs[0]}>`,
      },
      options: {
        showContent: true,
      },
    })
    const obligationOwnerCapId = ownerCaps.data[0]?.data?.objectId
    if (!obligationOwnerCapId) {
      throw new Error("Missing obligation owner cap.")
    }
    const { mergedCoinsMap } = suilendClient.claimRewards(
      accountAddress,
      obligationOwnerCapId,
      suilendClaimRewards,
      tx
    )
    const amountMap = buildRewardAmountMap(getRewardsForProtocol("Suilend"))
    const inputs = Object.entries(mergedCoinsMap)
      .filter(([, coin]) => Boolean(coin))
      .map(([coinType, coin]) => ({
        coinType,
        coin,
        amountAtomic: toAtomicAmount(amountMap.get(coinType) ?? 0, coinType),
      }))
    return { inputs, hasClaim: true }
  }

  const appendNaviClaim = async (tx: Transaction): Promise<ClaimResult> => {
    if (!accountAddress) return { inputs: [], hasClaim: false }
    const rewards = await getUserAvailableLendingRewards(accountAddress, {
      env: "prod",
    })
    const claimRewards = rewards.filter(
      (reward) => reward.userClaimableReward > 0
    )
    if (!claimRewards.length) return { inputs: [], hasClaim: false }
    const claimed = await claimLendingRewardsPTB(tx, claimRewards, {
      customCoinReceive: { type: "skip" },
    })
    const inputs = claimed
      .map((item, index) => {
        const reward = claimRewards[index]
        if (!reward) return null
        return {
          coinType: reward.rewardCoinType,
          coin: item.coin as TransactionObjectArgument,
          amountAtomic: toAtomicAmount(
            reward.userClaimableReward,
            reward.rewardCoinType
          ),
        }
      })
      .filter(
        (input): input is ClaimInput => Boolean(input)
      )
    return { inputs, hasClaim: true }
  }

  const appendScallopClaim = async (tx: Transaction): Promise<ClaimResult> => {
    if (!accountAddress) return { inputs: [], hasClaim: false }
    const builder = new ScallopBuilder({
      walletAddress: accountAddress,
      suiClients: [suiClient.inner],
    })
    await builder.init()
    const txBlock = builder.createTxBlock(tx)
    txBlock.setSender(accountAddress)
    const inputs: ClaimInput[] = []
    const amountMap = buildRewardAmountMap(getRewardsForProtocol("Scallop"))
    const rewardCoinName = builder.utils.getSpoolRewardCoinName()
    const rewardCoinType = builder.utils.parseCoinType(rewardCoinName)
    const spoolNames = Array.from(builder.constants.whitelist.spool)
    for (const spoolName of spoolNames) {
      const rewardCoins = await txBlock.claimQuick(spoolName)
      rewardCoins.forEach((coin: TransactionObjectArgument) => {
        inputs.push({
          coinType: rewardCoinType,
          coin,
          amountAtomic: toAtomicAmount(
            amountMap.get(rewardCoinType) ?? 0,
            rewardCoinType
          ),
        })
      })
    }
    const obligations = await builder.query.getObligationAccounts(accountAddress)
    for (const obligation of Object.values(obligations)) {
      if (!obligation) continue
      for (const debt of Object.values(obligation.debts)) {
        for (const reward of debt?.rewards ?? []) {
          if (!reward || reward.availableClaimCoin <= 0) continue
          const rewardCoinType = builder.utils.parseCoinType(reward.coinName)
          inputs.push({
            coinType: rewardCoinType,
            coin: await txBlock.claimBorrowIncentiveQuick(
              reward.coinName,
              obligation.obligationId
            ) as unknown as TransactionObjectArgument,
            amountAtomic: toAtomicAmount(
              amountMap.get(rewardCoinType) ?? 0,
              rewardCoinType
            ),
          })
        }
      }
    }
    return { inputs, hasClaim: inputs.length > 0 }
  }

  return {
    appendSuilendClaim,
    appendNaviClaim,
    appendScallopClaim,
  }
}
