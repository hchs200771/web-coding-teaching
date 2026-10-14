# Web Coding Teaching

「用 AI Agent 蓋網站：從 Claude Code 到 Git」是一份給完全初學者的繁體中文互動課程。左右切換章節，上下深入內容。內建 Git / GitHub 模擬終端機、六個任務、程式即時預覽與請求流程圖。

純 HTML、CSS、vanilla JS。沒有套件、CDN 或建置步驟。日常瀏覽與練習不需要連網；教材的安裝指令與外部文件連結需要網路。

## 本機啟動

從專案根目錄執行：

```sh
python3 -m http.server 8000
```

開啟 [http://localhost:8000](http://localhost:8000)。請透過 HTTP 開啟，ES modules 不適合直接用 `file://` 載入。

## 操作

| 操作             | 功能                                     |
| ---------------- | ---------------------------------------- |
| ← / →            | 上一章 / 下一章，回到該章第一張          |
| ↑ / ↓            | 章節內上一張 / 下一張                    |
| Space / PageDown | 下一張，章節結束後進入下一章             |
| PageUp           | 上一張，可跨章                           |
| Home / End       | 整份課程第一張 / 最後一張                |
| Esc / o          | 開啟或關閉總覽，點擊標題跳轉             |
| 觸控滑動         | 左右切章、上下切投影片；內容過長時先捲動 |

輸入欄位內不會觸發投影片快捷鍵。模擬終端機用 ↑ / ↓ 回顧指令。網址 `#/章節/投影片` 使用 **0-based** 編號，重新整理與瀏覽器上一頁都會保留位置。右上角切換主題，初始主題跟隨系統，手動選擇保存在此瀏覽器。

## GitHub Pages 部署

1. 把這些檔案放到自己的 GitHub repository。根目錄需包含 `index.html`、`css/`、`js/`。
2. 在 repository 的 **Settings → Pages** 選擇 **Deploy from a branch**。
3. 選擇放置檔案的分支（例如 `main`）與 **/ (root)**，儲存。
4. 等發布完成，開啟 Pages 提供的網址。

所有資源都使用相對路徑，支援 `https://帳號.github.io/repo名稱/`。無需 npm install、build 或 Actions 工作流程。

## 檔案

| 檔案                     | 用途                                        |
| ------------------------ | ------------------------------------------- |
| `index.html`             | 全部章節、投影片與互動元件的 HTML           |
| `css/style.css`          | 響應式排版、明暗主題、動畫與 reduced motion |
| `js/deck.js`             | 2D 導覽、hash、總覽、觸控與主題             |
| `js/copy.js`             | 指令複製按鈕與 clipboard fallback           |
| `js/tabs.js`             | 可重用的 OS 分頁與鍵盤操作                  |
| `js/git-sim.js`          | 無 DOM 的 Git、shell、gh 模擬核心           |
| `js/git-ui.js`           | 終端機、三區、SVG 歷史與任務畫面            |
| `js/missions.js`         | 任務、提示與完成條件                        |
| `js/playground.js`       | HTML/CSS/JS 編輯與隔離 iframe 預覽          |
| `js/request-flow.js`     | 點選與播放網站請求流程                      |
| `tests/git-sim.test.mjs` | 模擬器回歸測試                              |
| `tests/deck.test.mjs`    | 情境、任務、資源與流程整合檢查              |
| `tests/index.js`         | 讓目錄形式的測試命令可直接執行              |
| `package.json`           | ES module 宣告與 test 指令，無 dependencies |
| `.gitignore`             | 忽略本機與測試產物                          |
| `.prettierrc.json`       | 程式碼排版設定（選用，專案不依賴 prettier） |

## 驗證

安裝 Node.js 18+ 後執行，不需要安裝套件：

```sh
node --test tests/
```

也可以執行 `npm test`。若想逐一查看所有案例，可用 `node tests/index.js`。Node.js 24 也支援 `node --test --test-isolation=none tests/index.js`。

## 模擬器的限制

模擬器簡化真實 Git：hash 為教學用識別碼；同檔案合併衝突會採用來源分支內容並說明，不含完整衝突編輯器；clone 載入固定示範快照；gh 不連線、不開啟真實網頁。只支援 help 列出的指令與主要選項，不包含 rebase、stash、reflog、force push。練習狀態重整後消失；後悔藥任務在「重設」後保留完成標記，方便比較三種 reset。commit graph 中虛線的 commit 代表已不在任何分支上（例如 reset 之後），對應真實 Git 只能靠 reflog 找回的情況。

安裝指令可能隨版本更新，教之前建議對照 [Claude Code 官方文件](https://docs.claude.com/en/docs/claude-code/overview) 確認。
