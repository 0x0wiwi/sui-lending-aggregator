# Current Finance Lending 整合研究

> 查核日期：2026-08-24  
> 範圍：只採用 Current Finance、Mysten Labs、Cetus 的官方原始碼、官方前端、官方 API 與 Sui mainnet 鏈上資料  
> 參考地址：`0x818e8c2bc556194082151e7e00627b4aad722791bf28b00144ff24fe1d3fa2a1`

## 結論

Current Finance 有官方 TypeScript SDK 原始碼，能讀取 market、reserve、obligation、利率與 liquidity mining rewards，也能建立 claim PTB。不過目前未查到可驗證的 npm registry 發布版本。整合時應以官方 GitHub source 為準，並注意 README 使用的套件名與 `package.json` 不一致。

Claim 可透過 `liquidity_mining::claim_reward_as_coin` 直接取得 `Coin<RewardCoinType>`，再把同一個 PTB 內的回傳 coin 傳給 Cetus Aggregator `routerSwap`。Current SDK 目前的 convenience method 會立即把 coin transfer 給 recipient，因此 claim 加 swap 需要直接呼叫 Move function，或新增一個只回傳 coin argument 的薄封裝。

參考地址已從 Sui mainnet 讀到一個 MainMarket obligation，包含 SUI、xBTC、USDC 三筆 supply，沒有 borrow。官方 API 回傳的 owner cap、obligation 與 market 和鏈上資料一致。

## 第一方來源與版本

- Current 官方 SDK repository：[current-finance/current-sdk](https://github.com/current-finance/current-sdk/tree/cbe6d179735cdb80d462d14c723a90983be7a30c)
- 本次查核的 SDK commit：`cbe6d179735cdb80d462d14c723a90983be7a30c`
- Current 官方 Move interface repository：[current-finance/contract-interface](https://github.com/current-finance/contract-interface/tree/ef8851cb35ef8cb2ee813a8933d29cd971944de3)
- 本次查核的 interface commit：`ef8851cb35ef8cb2ee813a8933d29cd971944de3`
- Current 官方前端：[app.current.finance](https://app.current.finance/)
- Current 官方 API：[api.current.finance](https://api.current.finance/)
- Mysten 官方 mainnet fullnode：`https://fullnode.mainnet.sui.io:443`
- Cetus 官方 Aggregator repository：[CetusProtocol/aggregator](https://github.com/CetusProtocol/aggregator)
- Cetus 官方 Aggregator 文件：[Features Available](https://cetus-1.gitbook.io/cetus-developer-docs/developer/cetus-aggregator/features-available)

鏈上數值、價格、reward schedule 與 claimable amount 都會變動。本文的動態數值只是查核快照，不能當成設定常數。

## Mainnet package、object 與 market IDs

官方 SDK 的 [`sdk/src/config/networks.ts`](https://github.com/current-finance/current-sdk/blob/cbe6d179735cdb80d462d14c723a90983be7a30c/sdk/src/config/networks.ts) 只定義 mainnet，主要設定如下。

| 用途 | ID |
| --- | --- |
| Current protocol callable package | `0x45bae0425e9098ce5cba3d3fa2836220ad24c9f88aa0dffffb5a52b49319fc70` |
| Current protocol app object | `0xd4395f77a48f6d64af2008280c8dc06ee0fe69953a141e683935f6086d849177` |
| Market type origin package | `0xfe1d8929d13b00aaecd7642dec1c6d41cab82882a1b139efa46bf61dfd6380bf` |
| FLP package | `0xfbb9f951e243560e46ba65aed64105e4bc7c5e874b35fabf23259bec4458eccf` |
| FLP app object | `0x2bb9fb6913c1a8061a21876016b464077051c2914dd8bcd4d6cdb05a5884cc45` |
| Leverage package | `0xaab00c7753c4843716981350f869af1d0e57de360d3f5f5a3da5a52cd2aade47` |
| Leverage app object | `0xbfcd97b3f7219373c6f0a4cf556ab2e3a92d7879ab94c88efdd355a2bf80bc27` |
| xOracle package | `0xec244262968307f6b502f28bbf03aed94140e7467d1638b01a29ec5cc43fd769` |
| xOracle object | `0x7aca2c7d1aa11640f8de16c4b6a2c3a672eb69872eddd59ed22a073908840e1a` |
| Coin decimals registry | `0x53785858526d8ed3826cfc245b0fd53f16179036f38fc024c3851ef07b1538d7` |
| Sui Clock | `0x6` |

`Market` type 的原始 package 也由官方 Move repository 的 [`protocol/Published.toml`](https://github.com/current-finance/contract-interface/blob/ef8851cb35ef8cb2ee813a8933d29cd971944de3/protocol/Published.toml) 確認。呼叫交易要使用目前 callable package，type argument 則維持 origin package。

官方 SDK 目前列出六個 market。

| Market type | Market object |
| --- | --- |
| `0xfe1d8929d13b00aaecd7642dec1c6d41cab82882a1b139efa46bf61dfd6380bf::market_type::MainMarket` | `0x41f3d76aee8b20e53f7d0d395fdc09e241e683c7bc5d0f69674b545ee42549df` |
| `0xfe1d8929d13b00aaecd7642dec1c6d41cab82882a1b139efa46bf61dfd6380bf::market_type::AltCoinMarket` | `0x6f5230c346e27132b8d4d92cb3f4f9c7f4e736d5c32b8f0a2b063c97e67d78f7` |
| `0xfe1d8929d13b00aaecd7642dec1c6d41cab82882a1b139efa46bf61dfd6380bf::market_type::EmberMarket` | `0x8e85c433f791685c65fa66923110b8385e13f955daf8792ef805ce2d47139bbc` |
| `0xfe1d8929d13b00aaecd7642dec1c6d41cab82882a1b139efa46bf61dfd6380bf::market_type::MatrixGoldMarket` | `0xafe28c816d322a56bdab27b90d4b5e882a0a34ee2d9f02c6a07402a2b69be900` |
| `0xfe1d8929d13b00aaecd7642dec1c6d41cab82882a1b139efa46bf61dfd6380bf::market_type::EthenaMarket` | `0xeeef7e9abe201e16c3ca6417b91fa49bec28edcb077eb2fd4a1f126c251e6899` |
| `0xfe1d8929d13b00aaecd7642dec1c6d41cab82882a1b139efa46bf61dfd6380bf::market_type::Market01` | `0x2d682541f1e983e48d5c628f013d11d4c8f96f410338532791d3ece882766220` |

`networks.ts` 也為各 market asset 定義 `reserveId` 與 `balanceId`。參考地址涉及的 MainMarket reserve 如下。

| Asset | Reserve object | Balance object |
| --- | --- | --- |
| SUI | `0x1a86cba9f4010bd1bc3a03f48d6d974411fb019b1dc0919fc265d55963bcfa0d` | `0xfb094367ba02f778081335bc558f0ed735c63489a3eb9e8d13034558db5ee800` |
| xBTC | `0x51786de1e046d891c3212be5a63d9ee9e017978a0a891d659775785b9f2590e4` | `0xb032b33da753ed0a724877f292ba102c25320c6e65e7b2f149b95bbc54863fd5` |
| USDC | `0xbdc6f58cad76fe6bdf5c10788ae6c1c20ebaa223aaabc7fb94185e83a88f5193` | `0x296bad48a22775cf8e343acb2f33d2a6c0dfa1d160c40b6a2b0ba3cb92bf7e31` |

SDK 原始碼註解要求 protocol redeploy 後重新確認 reserve IDs，因此不能假設這些 ID 永久不變。

## Market 與 reserve 資料

### 鏈上資料

MainMarket object 的實際型別為：

```text
0xfe1d8929d13b00aaecd7642dec1c6d41cab82882a1b139efa46bf61dfd6380bf::market::Market<
  0xfe1d8929d13b00aaecd7642dec1c6d41cab82882a1b139efa46bf61dfd6380bf::market_type::MainMarket
>
```

查核版本 `975156379` 的重要 table object 如下。

| 欄位 | Object ID |
| --- | --- |
| Assets table，18 assets | `0x45b1966383567b4063c89bfe73098d0abed715c0f7f9c4f9f8a2b4cd2c955df5` |
| Reserves table | `0xf49efd08d015ba54ebf05d5e276bf8f4e17d331b3b851e8b260d6e41c69ed698` |
| Obligations table | `0x00954bb39d417343c28c4b6942f576a48069f4a66149f0b2344942c035779c8c` |
| Liquidity miner object | `0x19a0a26f2fed232648ff31f02e331249ecd4d20e559f53ab29619aac0b976b10` |
| Deposit reward manager table | `0x7f78dc06733de16ca7fff076207934cca2c7977f13ffa07f04d6cef1878b2085` |
| Borrow reward manager table | `0xd03dca2c480e727449fcc7679b4f9e933013e50573faff7b3c09faa2f05f5dac` |

### SDK query functions

官方 [`sdk/src/core/query.ts`](https://github.com/current-finance/current-sdk/blob/cbe6d179735cdb80d462d14c723a90983be7a30c/sdk/src/core/query.ts) 透過 dry-run Move query 讀取資料，主要函式與 target 如下。

| SDK function | Move target 或資料來源 | 用途 |
| --- | --- | --- |
| `getAssetMarketOverview` | `market_query::get_asset_market_overview` | 單一 asset 的 market totals、limits、utilization 等概覽 |
| `getAssetsMarketOverview` | 重複上述 query | 多個 asset 概覽 |
| `getAssetMarketRates` | `market_query::get_asset_market_rates` | `exchangeRate` 與 `borrowIndex` |
| `getAssetsMarketRates` | 重複上述 query | 多個 asset rates |
| `getMarketEmodeGroupOverview` | `market_query::get_market_emode_group_overview` | E-mode group 設定 |
| `getObligationAssets` | `obligation_query::get_obligation_assets` | obligation 涉及的 asset types |
| `getObligationOverview` | `obligation_query::get_obligation_overview` | E-mode、borrows、deposits |

`get_asset_market_overview` 的參數包含 market object、asset type string、coin decimals registry、價格分子與分母、Clock。價格不是 reserve object 自己回傳，呼叫端必須提供。

Base rate 計算在 [`sdk/src/market-types/market.ts`](https://github.com/current-finance/current-sdk/blob/cbe6d179735cdb80d462d14c723a90983be7a30c/sdk/src/market-types/market.ts)。Borrow rate 使用 kinked interest model，supply rate 為 borrow rate、utilization 與扣除 repay fee 後的乘積。

### 官方 Current API

官方前端使用以下 read endpoints。

```text
GET https://api.current.finance/market/getMarketList?marketType={marketType}&page=1&size=100
GET https://api.current.finance/market/getMarketInfo?marketName={marketName}&assetToken={assetToken}
GET https://api.current.finance/user/getObligationList/{address}
```

官方前端也使用 `https://stream.current.finance/stream/tokenInfo` 取得 token price SSE。2026-08-24 的 MainMarket API 快照共有 18 個 assets，參考地址涉及的三個 asset 如下。

| Asset | decimals | price | supplyAPY | borrowAPY |
| --- | ---: | ---: | ---: | ---: |
| SUI | 9 | 0.83545232 | 0.008844876155088 | 0.012889151313552 |
| xBTC | 8 | 77357.68 | 0.000500166983376 | 0.00500000000256 |
| USDC | 6 | 0.9999364 | 0.021077796043008 | 0.04107826505664 |

API 欄位名是 `supplyAPY` 與 `borrowAPY`，官方前端介面則以 APR 顯示。API 的版本策略、rate limit、可用性承諾與公開相容性文件未知，因此核心餘額與交易前檢查應以鏈上 query 為準，API 適合做 indexer 與顯示資料來源。

MainMarket API 會同時回傳預設主表與收合群組資產。官方前端把 `labelGroup == null` 的資產放在主表，有 `labelGroup` 的資產只有在 `Expand to show all` 後顯示。本專案只顯示 MainMarket 主表，並額外排除 `supplyPaused` 與 `borrowPaused` 同時為 `true` 的資產。Current 市場與持倉名稱只顯示幣種 symbol，不附加市場名稱。Rewards 與 Claim All 仍會讀取使用者的全部 Current obligations。

## 使用者 supply 與 borrow positions

### 找出 obligation

鏈上權威作法是使用 Mysten gRPC `listOwnedObjects`，owner 設為使用者地址，並以以下 type filter 找 owner caps。

```text
0xfe1d8929d13b00aaecd7642dec1c6d41cab82882a1b139efa46bf61dfd6380bf::obligation::ObligationOwnerCap
```

`QueryClient.getObligationOwnerCapDetail` 會從 owner cap object 解析 `obligation_id`、`market_type` 與 `market_id`。官方 API 的 `/user/getObligationList/{address}` 可作為 indexer 快速路徑，但交易前仍應查鏈上 object。

### Position 數量

`getObligationOverview` 的 BCS 結果包含：

- `borrows`: `asset`、建立 position 時的 `borrow_index`、`debt`
- `deposits`: `asset`、`ctoken_amount`
- `emode_group_id`

官方 [`sdk/src/core/client.ts`](https://github.com/current-finance/current-sdk/blob/cbe6d179735cdb80d462d14c723a90983be7a30c/sdk/src/core/client.ts) 的 `getObligationDetail` 使用當前 market rates 轉換：

```text
currentBorrowAtomic = ceil(debt × currentBorrowIndex ÷ positionBorrowIndex)
currentSupplyAtomic = floor(ctokenAmount × exchangeRate)
```

`exchangeRate` 與 index 使用 SDK 的 WAD 精度工具處理。顯示時再依 coin metadata `decimals` 截斷轉換。

### 參考地址驗證

Sui mainnet 與 Current API 都回傳同一筆 owner cap。

| 欄位 | 值 |
| --- | --- |
| Owner cap | `0xb0141a3d64a7969e54a4ab8344d88e3fc4e05759c6ed8f4a7283ba4a722780ed` |
| Obligation | `0x5310be920746b2a4b8cd3da4bc9d034c7993cd7f2c784715102fece52c34460e` |
| Market | MainMarket，`0x41f3d76aee8b20e53f7d0d395fdc09e241e683c7bc5d0f69674b545ee42549df` |
| E-mode group | `0` |

官方 SDK dry-run 讀到沒有 borrows，並有三筆 deposits。

| Asset | cToken atomic | exchangeRate raw | current supply atomic | 顯示數量 |
| --- | ---: | ---: | ---: | ---: |
| SUI | 23920055272022 | 1006697960365661896 | 24080270854178 | 24080.270854178 |
| xBTC | 20005152 | 1000392662112213637 | 20013007 | 0.20013007 |
| USDC | 150589105097 | 1007880834898472385 | 151775872971 | 151775.872971 |

同一快照的 `borrowIndex` 分別為 SUI `1009481547768603525`、xBTC `1002212402424071705`、USDC `1016033700410263880`。數值會隨區塊更新。

## Rewards APR 與 pending rewards

官方 [`sdk/src/core/liquidity-mining.ts`](https://github.com/current-finance/current-sdk/blob/cbe6d179735cdb80d462d14c723a90983be7a30c/sdk/src/core/liquidity-mining.ts) 提供 `LiquidityMiningClient`，主要 functions 如下。

| Function | 用途 |
| --- | --- |
| `getActiveRewardsSummary` | 取得 market 目前 active reward schedules 與 APR |
| `getAllRewardsSummary` | 取得所有 schedules |
| `getClaimableRewards` | 取得 obligation 在指定 reserve coin 的 pending rewards |
| `getClaimableRewardsBatch` | 批次取得 pending rewards |
| `getRewardIndices` | 取得 deposit 或 borrow pool reward indices |

`RewardType` 的值為 `Deposit = 0`、`Borrow = 1`。Reward manager 的 dynamic field key/value layout 為：

```text
Pool table key: 0x1::type_name::TypeName
Pool table value: 0xfe1d...::liquidity_mining_reward_manager::PoolRewardManager
Obligation subtable key: 0x2::object::ID
Obligation subtable value: 0xfe1d...::liquidity_mining_reward_manager::ObligationRewardManager
```

SDK 會依目前時間在本機推進 cumulative reward per share，再將 obligation share 與已記錄的 index 差額轉成 claimable atomic amount，最後向下取整。

Reward APR 需要呼叫端提供 `priceMap`，公式概念如下。

```text
rewardAPR = annualized(rewardAmount ÷ totalShares)
  × decimalAdjustment
  × rewardCoinPrice ÷ reserveCoinPrice
```

SDK 使用一年 `31536000000` milliseconds。超出 schedule active window 時 APR 回傳 0。官方前端把 deposit reward APR 加到 base supply APR，也把 borrow reward APR 作為 borrow 成本的抵減項。

### 參考地址 reward 快照

使用鏈上 pool manager、obligation manager、鏈上 coin decimals 與 Current 官方 API price，於 `checkedAtMs = 1787519029411` 計算如下。三個 schedule 的 active window 都是 `1786964400000` 至 `1788174000000`。

| Reserve | Reward | Reward index | Claimable atomic | Claimable | Reward APR |
| --- | --- | ---: | ---: | ---: | ---: |
| SUI deposit | SUI | 12 | 313862772 | 0.313862772 SUI | 1.169494% |
| xBTC deposit | SUI | 2 | 1167893286 | 1.167893286 SUI | 5.577925% |
| USDC deposit | SUI | 15 | 8767339014 | 8.767339014 SUI | 8.095994% |

該快照合計約 `10.249095072 SUI`。參考地址沒有 borrow position，因此沒有對應 borrow reward。Claimable 會持續變動，組 PTB 前必須重讀。

## Claim 的單一 PTB Move call

官方 SDK 的 `populateClaimRewardTransaction` 呼叫以下 function。

```text
0x45bae0425e9098ce5cba3d3fa2836220ad24c9f88aa0dffffb5a52b49319fc70
  ::liquidity_mining::claim_reward_as_coin
```

Type arguments：

1. Market type
2. Reserve coin type
3. Reward coin type

Arguments：

1. Protocol app object `0xd4395f77a48f6d64af2008280c8dc06ee0fe69953a141e683935f6086d849177`
2. Market object
3. Obligation owner cap
4. Reward type `u8`
5. Reward index `u64`
6. Clock `0x6`

官方 Move source [`liquidity_mining.move`](https://github.com/current-finance/contract-interface/blob/ef8851cb35ef8cb2ee813a8933d29cd971944de3/protocol/sources/user/lending/liquidity_mining.move) 的 signature 明確回傳 `Coin<RewardCoinType>`。

```move
public fun claim_reward_as_coin<MarketType, _CoinType, RewardCoinType>(
    app: &mut LendingApp,
    market: &mut Market<MarketType>,
    obligation_owner_cap: &ObligationOwnerCap,
    reward_type: u8,
    reward_index: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): Coin<RewardCoinType>
```

同一個 `Transaction` 可以加入多個 reward schedule 的 call，所以多筆 reward 可以在單一 PTB claim。每一個 schedule 仍各自需要一個 Move call。SDK 的 `populateClaimRewardAutoTransaction` 正是以同一個 transaction 逐筆加入 call。

## Claim coin 接 Cetus swap

Cetus 官方 Aggregator 文件與 [官方 README](https://github.com/CetusProtocol/aggregator/blob/main/README.md) 說明 `routerSwap` 的 `inputCoin` 可接受 `TransactionObjectArgument`，並會完全消耗該 input coin。`routerSwap` 也接收現有的 `Transaction`，並回傳 output coin，因此可直接串在 Current claim call 後面。

```ts
const [rewardCoin] = tx.moveCall({
  target: `${protocolPackageId}::liquidity_mining::claim_reward_as_coin`,
  typeArguments: [marketType, reserveCoinType, rewardCoinType],
  arguments: [
    tx.object(protocolAppId),
    tx.object(marketObjectId),
    tx.object(obligationOwnerCapId),
    tx.pure.u8(rewardType),
    tx.pure.u64(rewardIndex),
    tx.object("0x6"),
  ],
});

const outputCoin = await aggregatorClient.routerSwap({
  router,
  txb: tx,
  inputCoin: rewardCoin,
  slippage,
});

tx.transferObjects([outputCoin], recipient);
```

重要限制：

- Current SDK 的 `populateClaimRewardTransaction` 在 claim 後立刻 `transferObjects`，不能原樣拿來串 swap
- 應直接組上述 Move call，或加一個回傳 `TransactionObjectArgument` 的薄封裝
- Cetus route quote 在 PTB 建立前於鏈下取得，quote amount 應使用剛查得且向下取整的 claimable atomic amount
- Reward 在 quote 與執行之間可能增加。Cetus 會消耗完整 input coin，實際 route 對數量差異的容忍度應在 dev-inspect 與實際小額交易驗證
- 本次沒有參考地址的 signing key，因此沒有提交 claim 或 claim 加 swap，也沒有產生價值變動

Current SDK workspace 有依賴 `@cetusprotocol/aggregator-sdk`，但沒有找到 Current 專用的 claim-and-swap helper。

## Coin metadata 與 decimals

官方 [`sdk/src/utils/coin-metadata.ts`](https://github.com/current-finance/current-sdk/blob/cbe6d179735cdb80d462d14c723a90983be7a30c/sdk/src/utils/coin-metadata.ts) 的 `getCoinMetadata(client, coinType)` 呼叫 Mysten Sui gRPC `client.getCoinMetadata`，讀取：

- metadata object ID
- `decimals`
- `name`
- `symbol`
- `description`
- `iconUrl`

`parseCoinDecimals` 使用 `10 ** decimals` 做 atomic 與 display amount 轉換。SDK 也內建 mainnet metadata JSON cache，但精確 claim、swap 與顯示應優先使用鏈上 `getCoinMetadata`，cache 只能作效能最佳化。

參考地址三個 supplied coins 的鏈上 decimals 為 SUI 9、xBTC 8、USDC 6，和 Current API 快照一致。

Liquidity mining APR code 在 metadata 讀取失敗時有 fallback 9 decimals。這對精確 atomic amount 有風險，整合時不應沿用 fallback。metadata 缺失應視為該 coin 暫時不可 claim 或 swap，直到能取得鏈上 decimals。

## 官方 SDK 狀態

官方 repository 根目錄稱它為 Sample TypeScript SDK。實際 [`sdk/package.json`](https://github.com/current-finance/current-sdk/blob/cbe6d179735cdb80d462d14c723a90983be7a30c/sdk/package.json) 是：

```json
{
  "name": "@current-protocol/current-sdk",
  "version": "2.0.0"
}
```

README 部分文字使用 `@current-finance/current-sdk`，和 `package.json` 不一致。本次未找到可驗證的 npm registry package，因此目前能確認的是官方 source SDK，而不是穩定發布的 npm SDK。若要正式依賴，需選擇鎖定 Git commit、vendor source，或先向 Current 團隊確認正式 distribution channel。

## 建議整合流程

1. 從 `networks.ts` 建立 mainnet markets 與 reserve config，啟動時用鏈上 object type 驗證重要 IDs
2. 用 `listOwnedObjects` 找 `ObligationOwnerCap`，再用 `getObligationOverview` 與 market rates 算 supply 和 borrow
3. 用鏈上 `getCoinMetadata` 決定 decimals，所有 atomic amount 採向下取整，0 atomic amount 直接過濾
4. 用 `LiquidityMiningClient` 讀 active schedules、reward indices 與 claimable rewards
5. Reward APR 的 priceMap 可沿用 Current 官方 price SSE/API，但需處理服務不可用與 stale price
6. Claim-only 可用 SDK convenience method
7. Claim 加 swap 應直接取得 `claim_reward_as_coin` 回傳 coin，傳給同一 PTB 的 Cetus `routerSwap`
8. 交易送出前重讀 owner cap、obligation、reward schedule、claimable amount 與 Cetus route

## 已知未知與未驗證項目

- 未確認 Current SDK 的正式 npm 發布與版本相容政策
- 未找到 Current API 與 price SSE 的公開 SLA、rate limit、versioning 或 schema 保證
- SDK reward APR 的 `priceMap` 由呼叫端提供，沒有 Current SDK 內建的單一鏈上 price read helper
- 未找到官方鏈上單次查詢地址全部 owner caps 的 Current helper，可靠作法是 Mysten `listOwnedObjects` 或 Current API indexer
- 未使用參考地址簽名，所以沒有執行 claim、swap 或其他 state-changing transaction
- Claimable amount 在 quote 和執行間增加時，Cetus route 的實際行為仍需用可簽名錢包做小額 mainnet 驗證
- Market、reserve 與 reward manager object IDs 可因 upgrade 或 redeploy 改變，應鎖定 SDK commit 並加入啟動驗證
