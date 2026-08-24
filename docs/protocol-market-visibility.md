# 協議市場顯示與 supply 可用性

本文件整理 Lending Aggregator 判斷市場是否應顯示的官方資料來源。目標是只顯示目前可以新增 supply 的市場，同時不影響既有部位的 withdraw、repay 與 reward 顯示。

資料快照日期為 2026-08-24，網路為 Sui mainnet。mainnet 資產清單會隨協議設定改變，實作必須在每次抓取時判斷，不能把本文列出的 symbol 寫死。

## 建議規則摘要

| 協議 | 明確停用欄位 | 當下無法 supply 欄位 | 建議市場顯示條件 |
| --- | --- | --- | --- |
| Scallop | `constants.whitelist.deprecated.has(pool.coinName)` | `pool.maxSupplyCoin <= pool.supplyCoin` | 不在 `deprecated` 且剩餘 supply cap 大於 0 |
| Navi | `pool.deprecatedAt <= Date.now()` 或 `pool.status === "deprecated"` | `Number(pool.leftSupply) <= 0` | 尚未到 deprecated 時間且 `leftSupply > 0` |
| Suilend | 沒有獨立的 deprecated 或 paused 欄位 | `reserve.config.depositLimit`、`depositLimitUsd` 與目前 deposits | token 與 USD 的剩餘 deposit limit 都大於 0 |
| AlphaLend | `getAllMarkets()` 已排除 `config.active === false` | `market.allowedDepositAmount` | `allowedDepositAmount.gt(0)` |

`supply APR === 0`、`borrow APR === 0`、`utilization === 0` 與 oracle 顯示狀態都不能當作 supply 開關。這些數值可以在正常市場合法出現。

## Scallop

### 官方欄位

Scallop SDK 的 `Whitelist` 同時公開 `lending` 與 `deprecated` 集合。`getMarketPools()` 預設用 `whitelist.lending` 取得市場，因此只使用市場回傳清單不足以排除棄用資產，還要額外檢查 `whitelist.deprecated`。

- [`Whitelist` 型別](https://github.com/scallop-io/sui-scallop-sdk/blob/v3.0.2/src/types/constant/common.ts)
- [`ScallopConstants` 從官方 API 載入 whitelist](https://github.com/scallop-io/sui-scallop-sdk/blob/v3.0.2/src/models/scallopConstants.ts)
- [Scallop mainnet whitelist API](https://sui.apis.scallop.io/pool/whitelist)
- [`MarketPool` 的 `supplyCoin` 與 `maxSupplyCoin`](https://github.com/scallop-io/sui-scallop-sdk/blob/v3.0.2/src/types/query/core.ts)
- [SDK 從鏈上 `supplyLimit` 計算 `maxSupplyCoin`](https://github.com/scallop-io/sui-scallop-sdk/blob/v3.0.2/src/utils/query.ts)

可靠判定如下：

1. `deprecated.has(pool.coinName)` 代表官方產品已將資產標成棄用，即使它仍存在於 `lending` 集合也不應顯示為可供新增 supply 的市場。
2. `maxSupplyCoin <= supplyCoin` 代表供給上限沒有剩餘空間。`maxSupplyCoin === 0` 且已有供給量時，實際效果就是只能保留或提領既有部位。

### Mainnet 快照

官方 whitelist 當時標記的 deprecated 資產為 `wAPT`、`wUSDC`、`wUSDT`、`wETH`、`wBTC`、`vSUI`、`FUD`、`BLUB`。其中前七項的 `maxSupplyCoin` 均為 0。`BLUB` 仍有正的 supply cap，但官方仍標記 deprecated，因此 cap 不能取代 deprecated 判定。

另有 `mUSD` 未標記 deprecated，但 `maxSupplyCoin` 為 0。若需求是「只顯示現在能 supply」，它也應由容量規則排除。

### 限制

SDK 的 supply builder 本身只驗證資產在 `whitelist.lending`，沒有用 `deprecated` 阻止交易。因此 `deprecated` 是官方產品可用性訊號，不是 builder 的完整鏈上 preflight。若需要判斷特定輸入數量是否成功，仍要在送出前 dry run。

## Navi

### 官方欄位

Navi `Pool` 直接提供 `isDeprecated`、`deprecatedAt`、`status`、`leftSupply` 與 `supplyCapCeiling`。官方 SDK 的 `depositCoinPTB()` 在 `Date.now() > deprecatedAt` 時直接拋出錯誤，因此 `deprecatedAt` 是最接近實際交易路徑的硬停用條件。

- [官方 `Pool` 型別](https://github.com/naviprotocol/naviprotocol-monorepo/blob/main/packages/lending/src/types.ts)
- [`getPools()` 與 `depositCoinPTB()` 實作](https://github.com/naviprotocol/naviprotocol-monorepo/blob/main/packages/lending/src/pool.ts)
- [Navi mainnet pools API](https://open-api.naviprotocol.io/api/navi/pools?env=prod&market=main)

可靠判定如下：

1. `deprecatedAt` 已到期時一定不能 deposit，應排除。
2. `status === "deprecated"` 與已到期的 `deprecatedAt` 在目前 API 一致，可作為可讀性較高的輔助條件。
3. `leftSupply <= 0` 表示當下沒有可用 supply capacity。它可能因治理調整 cap 後重新開放，因此屬於動態不可用，不代表永久 deprecated。

### Mainnet 快照

當時 main market 的 deprecated 例子包含 `YBTC.B`、`IKA`、`HAEDAL`、`BLUE`、`stBTC`、`NS`、`AUSD`、舊 `WBTC`、`CETUS`、`WETH` 與 `wUSDT`。

`enzoBTC` 的狀態仍為 active，但 `leftSupply` 為 0。`XAUm` 的 `leftSupply` 為負值。兩者都說明只過濾 deprecated 不足以滿足「目前可 supply」的需求。

專案目前支援的 SUI、USDC、suiUSDT、xBTC、DEEP、WAL 在快照當下皆為 active 且 `leftSupply > 0`。

### 限制

`isDeprecated` 可能涵蓋正在 deprecating、但尚未到 `deprecatedAt` 的市場。若需求是完全貼合 SDK 是否允許建交易，應以到期時間為準。若需求是提早隱藏即將棄用的資產，可額外使用 `isDeprecated` 或 `status !== "active"`，但這會比實際交易限制更嚴格。

`oracle.valid` 在目前 API 不能作為 UI supply 開關，快照中多個正常 active 市場也回傳 false。

## Suilend

### 官方欄位

Suilend 的 `ParsedReserve.config` 提供 token 數量的 `depositLimit` 與美元價值的 `depositLimitUsd`。公開 reserve 模型沒有 deprecated、hidden 或 paused boolean。

- [`ParsedReserve` 與 `depositLimit`、`depositLimitUsd`](https://github.com/suilend/suilend-fe-public/blob/main/sdk/src/parsers/reserve.ts)
- [鏈上 `ReserveConfig` 定義](https://github.com/suilend/suilend/blob/devel/contracts/suilend/sources/reserve_config.move)
- [主市場 `LENDING_MARKET_ID` 與 SDK 初始化](https://github.com/suilend/suilend-fe-public/blob/main/sdk/src/client.ts)
- [Suilend lending market 合約文件](https://github.com/suilend/suilend/blob/devel/docs/suilend/lending_market.md)

可靠判定如下：

1. `depositLimit <= 0` 或 `depositLimitUsd <= 0` 代表 reserve 不接受新增 supply。
2. 正值 limit 仍可能已額滿。先以 `depositedAmount - unclaimedSpreadFees` 取得合約使用的 total supply，再同時確認 token limit 與 `depositLimitUsd - totalSupply * maxPrice > 0`。後者對齊鏈上 `market_value_upper_bound`，不能只用一般顯示價格。
3. limit 是管理者可調整的鏈上設定，因此每次 market refresh 都要重算。

### Mainnet 快照

主市場中 token 與 USD deposit limit 均為 0 的例子包含 `wUSDC`、`wUSDT`、`wETH`、`AUSD`、`FUD`、`HIPPO`、`NS`、`UP`、`KOBAN`、`DMC`、`IKA`、`ALKIMI`。這些 reserve 仍保留既有 `ctokenSupply` 或 liquidity，不應因市場列被隱藏而遺失使用者部位資料。

專案目前支援的 SUI、USDC、xBTC、DEEP 與其選定的 active 版本在快照當下都有正的 deposit limit。

### 限制

Suilend 沒有一個可直接等同「deprecated」的欄位。`openLtvPct === 0` 只代表不能作為新增借款能力的抵押品，不能推論 supply 被關閉。`borrowLimit === 0` 也只關閉 borrow，不應用來隱藏仍可 supply 的市場。

## AlphaLend

### 官方欄位

AlphaLend 鏈上 `MarketConfigType` 有 `active`。官方 SDK 的 `Blockchain.getAllMarkets()` 已用 `market.config.active` 過濾，公開的 `AlphalendClient.getAllMarkets()` 因此只回傳 active markets。

公開的 `MarketData.allowedDepositAmount` 是 `depositLimit - totalLiquidity` 截到最小 0 後的結果。官方文件也將它定義為該市場還能 deposit 的最大數量。

- [AlphaLend SDK 官方文件](https://alphafitech.github.io/alphalend-sdk-js/)
- [`MarketConfigType.active`](https://github.com/AlphaFiTech/alphalend-sdk-js/blob/main/src/utils/parsedTypes.ts)
- [`getAllMarkets()` 過濾 inactive 市場](https://github.com/AlphaFiTech/alphalend-sdk-js/blob/main/src/models/blockchain.ts)
- [`allowedDepositAmount` 計算](https://github.com/AlphaFiTech/alphalend-sdk-js/blob/main/src/models/market.ts)
- [`MarketData` 型別](https://github.com/AlphaFiTech/alphalend-sdk-js/blob/main/src/core/types.ts)

可靠判定如下：

1. 使用 `AlphalendClient.getAllMarkets()` 時不需要再檢查 active，因為 inactive markets 已不在結果內。
2. `allowedDepositAmount.lte(0)` 代表該 active market 當下沒有新增 supply 容量，應排除。

### Mainnet 快照

仍為 active、但 `allowedDepositAmount` 為 0 的例子包含 `LBTC`、`BTCvc`、`DMC`、舊 `wBTC`、`eWAL`、`UP`、`SOL`、`ALPHA`、`suiUSDe`、`dbUSDC`、`dbUSDSUI`、`eBTC`、`ALKIMI`。這再次說明 active 不等同目前可 supply。

專案目前支援的 SUI、USDC、suiUSDT、xBTC、DEEP、WAL 在快照當下 `allowedDepositAmount > 0`。

### 限制

`MarketData` 已丟失原始 `config.active`，若未來改用未過濾的 raw market API，必須重新加入 active 判定。`allowedDepositAmount` 只反映 deposit cap 與總流動性，不保證涵蓋所有交易上下文限制。送出大額交易前仍應 dry run。

## 資料流邊界

市場可見性與使用者部位必須分開處理：

- market rows 依上表排除不能新增 supply 的市場
- user positions、Reward Summary、withdraw 與 repay 仍使用完整的使用者資料

這可避免 Scallop deprecated 與 Suilend deposit limit 為 0 的資產從市場比較表消失時，同時讓使用者失去提領既有部位的入口或資訊。
