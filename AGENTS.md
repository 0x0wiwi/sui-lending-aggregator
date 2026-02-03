# Repository Guidelines

## 專案結構與模組組織
- `src/` 為 React + TypeScript 應用程式來源。入口為 `src/main.tsx` 與 `src/App.tsx`。
- `src/components/ui/` 放置共用 UI 元件（shadcn/ui 風格）。
- `src/lib/` 放置共用工具（例如 `src/lib/utils.ts`）。
- `src/assets/` 放置打包資產；`public/` 放置原樣輸出的靜態檔案。
- 建置輸出在 `dist/`（lint 已忽略）。

## 建置、測試與開發指令
- `npm run dev` — 啟動 Vite 開發伺服器。
- `npm run build` — 先 `tsc -b` 型別檢查，再由 Vite 產出正式版。
- `npm run lint` — 使用 ESLint 檢查程式碼。
- `npm run preview` — 在本機預覽已建置的正式版。

## 程式碼風格與命名規範
- 語言：TypeScript + React（TSX）。
- 縮排 2 空格並使用分號，與現有檔案一致（如 `src/App.tsx`）。
- 元件與檔名使用 `PascalCase`；變數與函式使用 `camelCase`。
- 可重用 UI 元件放 `src/components/ui/`，共用工具放 `src/lib/`。
- `eslint.config.js` 定義檢查規則，請遵循 ESLint 建議。

## 測試準則
- 目前未配置自動化測試框架。
- 若新增測試，請在 `package.json` 補上指令並記錄框架。
- 目前以 `npm run dev` 手動驗證，並用 `npm run build` 確保型別正確。

## Commit 與 Pull Request 規範
- 近期紀錄採用簡短、祈使、全小寫主旨（例如：`remove example component`）。
- Commit 內容聚焦單一變更並簡潔描述。
- PR 需提供摘要、測試指令與結果，UI 變更請附截圖。

## 設定備註
- Vite 設定在 `vite.config.ts`；TypeScript 設定在 `tsconfig*.json`。
- Tailwind 透過 Vite 與 `src/index.css` 連接，請維持既有使用方式。

## Agent 專用指示
- 所有 agent 互動與文件均使用繁體中文。
- 程式碼內僅註解使用繁體中文；程式碼本身使用英文命名。
- UI 文字與介面文案一律使用英文。

## UI 與設計規範
- UI 元件僅能使用 shadcn，安裝與使用請參考 `https://ui.shadcn.com/docs/components` 提供的指令。
- `@/src/components/ui/` 內的檔案為 shadcn 安裝產物，禁止修改。
- 介面風格為簡潔風格，必須同時支援 dark mode 與 light mode。
- 操作優先以網頁版為主，並提供響應式設計；手機版需簡潔且易操作。

## 區塊鏈整合參考
- Sui dApp 開發參考：`https://sdk.mystenlabs.com/sui`
- 相關專案整合參考：
  - `https://naviprotocol.gitbook.io/navi-protocol-docs`
  - `https://docs.scallop.io/`
  - `https://docs.suilend.fi/ecosystem/suilend-sdk-guide`
  - `https://github.com/CetusProtocol/aggregator`
  - `https://github.com/CetusProtocol/cetus-sdk-v2`
- 網路環境統一使用 Sui mainnet，不需支援多網路切換。
- 資料來源優先透過官方 SDK 取得；若需定時更新，採 5 秒輪詢。
- 頁面提供 `Refresh` 按鈕供使用者手動更新資料。
- APR 僅顯示加總值；hover 時以多行顯示組成明細。
- Sui 錢包整合以 Mysten Labs dApp Kit 為主，無需自訂錢包設定。

## 開發流程與品質控管
- 每完成一個段落後，需執行 `npm run lint` 與 `npm run build` 確認無錯誤。
- 使用 `agent-browser` 進行功能測試；若有錯誤可用 `chrome-devtool` 的 MCP 檢視錯誤訊息。
- 每完成一個主要功能後需進行 code review，確保符合團隊標準。
- 目前不需實作單元測試，使用手動測試即可。
- 上述流程通過後需 `git commit`，並使用清楚的訊息，如 `feat: add user authentication feature` 或 `fix: resolve issue with data fetching`。

## Claim 與 Swap（PTB 整合）
- 目前四個協議（Scallop、Navi、Suilend、AlphaLend）皆使用 **單一 PTB** 完成 claim；claim + swap 也能在 **同一筆 PTB** 內串接完成。
- 交換流程以聚合器（Cetus）進行，若無路由或數量過小，則視為不可 swap，但不影響 claim 本身的 PTB 組合能力。

## 小數點與數量處理
- 所有幣種小數位數以鏈上 `getCoinMetadata` 的 `decimals` 為準。
- 顯示與 swap/claim 計算都使用 **截斷（ROUND_FLOOR）**，避免超出鏈上可表示的精度。
- 任何換算後的原子量為 0 的數量，視為不可 claim / swap，需在 UI 與交易組合時過濾。
