# Sui Lending Dashboard

以 **Sui mainnet** 為目標的借貸資訊儀表板，整合多個協議的供借利率、激勵與使用者持倉，並提供 claim / claim + swap 流程。介面採簡潔風格，支援 light/dark mode 與行動裝置。

## 功能概覽
- 協議整合：Scallop / Navi / Suilend / AlphaLend
- 資產：SUI / USDC / USDT / XBTC / DEEP / WAL
- 表格排序 / 篩選（資產、協議、只看持倉、只看 incentives）
- Reward Summary（依協議與總和顯示）
- Claim / Claim + Swap（單一 PTB）
- 5 秒自動刷新 + 手動 Refresh
- URL 預覽地址：`?address=0x...`

## 技術棧
- React 19 + TypeScript + Vite
- shadcn/ui + Tailwind CSS
- Sui dApp Kit / @mysten/sui
- Cetus Aggregator（swap）

## 開發指令
```bash
npm install
npm run dev
npm run lint
npm run build
npm run preview
```

## 專案結構（重點）
```
src/
  components/
    reward-summary/        # Reward Summary UI 模組
    market-table/          # 表格格式化
  hooks/
    claim/                 # 各協議 claim builder
    use-claim-rewards.ts
    use-market-data.ts
    use-market-filters.ts
  lib/
    market-fetch/          # 各協議資料抓取
    reward-utils.ts        # rewards 正規化與判斷
```

## Claim / Swap 行為
- Claim 與 Claim + Swap 皆以 **單一 PTB** 組合完成。
- Swap 使用 Cetus Aggregator，slippage 固定 **0.1%**。
- 若無路由或數量過小，會阻擋 swap，但 claim 仍可執行。

## 小數位處理
- decimals 透過鏈上 `getCoinMetadata` 取得。
- 顯示與 swap/claim 計算皆採 **截斷（ROUND_FLOOR）**。
- 換算後原子量為 0 則視為不可 claim / swap。

## 資料更新
- 自動每 5 秒更新一次。
- 也可點擊 `Refresh` 手動更新。

## 注意事項
- 僅支援 **Sui mainnet**，不提供多網路切換。
- 預覽地址模式（`?address=`）不提供 claim 按鈕。
- UI 文案固定英文，文件與協作使用繁體中文。

## AI 工具揭露
本專案在開發與維護過程中可能使用 AI 輔助工具（例如：程式碼建議、重構、文件草擬與測試輔助）。使用工具包含 **gpt-5.2-codex** 與 **codex-cli**。所有變更仍由開發者審閱與負責，並以專案規範與實際需求為準。

## License
尚未指定（請補上授權條款）。
