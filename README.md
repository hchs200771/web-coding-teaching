# Web Coding Teaching

「用 Claude Code 管理你的網站」是一份給 Windows 10/11 完全初學者的繁體中文互動課程，分成三堂課，每堂約 2.5–3 小時。第一堂裝好工具並試用 Claude Code；第二堂認識前後端，用 Git / GitHub 存檔、救回與上傳 Lovable 網站；第三堂用自己的網域上線，學 Claude 進階用法與省 token 習慣。00 章請課前完成。標「自學」的投影片課堂上跳過，回家有興趣再看；附錄供自學與查閱。

內建後端功能小測驗、拍照存檔動畫、5 個引導任務與自由練習，以及 Git 練習場（14 題）。任務模組另外保留 undo、remote、gh 三個舊任務供測試與日後使用。

## 課程章節

| 堂次 | # | 章節 | 內容 |
| -- | -- | -- | -- |
| 第一堂（約 2.5 小時） | 00 | 上課前要準備 | 課前完成訂閱、帳號與電腦準備 |
| 第一堂 | 01 | 課程介紹 | 三堂課安排、投影片操作方式 |
| 第一堂 | 02 | VS Code 安裝與介紹 | 下載安裝、繁體中文、資料夾、畫面區塊、終端機 |
| 第一堂 | 03 | Claude Code 安裝與試用 | 安裝、PATH、登入、狀態列、練習資料夾；自學：Claude in Chrome |
| 第二堂（約 3 小時） | 04 | 網站前端與後端 | 請求流程、前後端、靜態與動態網站、SEO |
| 第二堂 | 05 | Git 第一章：存檔 | 安裝 Git 與 gh、登入、五個名詞、四個區域、口語存檔與救回 |
| 第二堂 | 06 | Git 第二章：分支簡介 | 分支圖解、口語開草稿、切換與合併 |
| 第二堂 | 07 | Git 第三章：實戰 | Lovable、GitHub、clone、預覽、push；自學：GitHub Pages、SSH |
| 第三堂（約 3 小時） | 08 | 用自己的網域上線 | GitHub Actions、網域驗證、DNS、HTTPS |
| 第三堂 | 09 | Claude 進階使用 | CLAUDE.md、記憶、Skill、Hook、Workflow、Multi-agent |
| 第三堂 | 10 | 省 token：讓額度用更久 | 對話記憶、清空與濃縮、progress.md、精簡規則、模型與工具 |
| 附錄（自學） | 11 | 附錄：小抄、自學與練習場 | 說法小抄、手打 Git 指令、Git 練習場、自由練習、資源連結 |

## 上課前

- 學員需要 Claude Code 可用的方案：Pro、Team 或 Max；或用別人的分享碼免費 7 天，但要現場綁定信用卡。免費 claude.ai 帳號不能用 Claude Code。
- 先註冊 GitHub，記得 Lovable 帳號密碼，手機要能收驗證信。
- 知道電腦的管理員密碼；安裝 Git、Node.js 時可能跳出權限確認。
- Claude Code 安裝時畫面會停住 5 到 10 分鐘才出現文字，屬正常現象。

現場遇過的卡關（找不到 `claude`、條款更新的 API Error 400、npm 被 PowerShell 擋下等）都已寫進對應的投影片。

Git 練習場的版面與配色參考高見龍「為你自己學 Git」的 [Git 練習場](https://gitbook.tw/playground)。

線上版：[https://hchs200771.github.io/web-coding-teaching/](https://hchs200771.github.io/web-coding-teaching/)（GitHub Pages，從 `main` 分支根目錄部署）

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
| `img/`                   | GitHub、VS Code 真實畫面截圖                |
| `js/deck.js`             | 2D 導覽、hash、總覽、觸控與主題             |
| `js/copy.js`             | 指令複製按鈕與 clipboard fallback           |
| `js/tabs.js`             | 可重用的 OS 分頁與鍵盤操作                  |
| `js/git-sim.js`          | 無 DOM 的 Git、shell、gh 模擬核心           |
| `js/git-ui.js`           | 任務練習的畫面：任務面板、三區、commit 圖   |
| `js/missions.js`         | 任務、提示與完成條件                        |
| `js/playground.js`       | HTML/CSS/JS 編輯與隔離 iframe 預覽          |
| `js/backend-quiz.js`     | 紋繡網站功能：是否需要後端的小測驗          |
| `js/stage-demo.js`       | 工作目錄 → 暫存區 → 儲存庫的拍照存檔動畫    |
| `js/request-flow.js`     | 點選與播放網站請求流程                      |
| `js/terminal.js`         | 模擬終端機（輸出區、輸入列、↑↓ 叫回指令）   |
| `js/commit-graph.js`     | commit 圖：版面配置、動畫、標籤、圖例       |
| `js/git-graphs.js`       | 本地/遠端 commit 圖 + 圖例（兩種練習共用）  |
| `js/file-explorer.js`    | 檔案瀏覽器：目前內容與跟最新 commit 的差異  |
| `js/dom.js`              | 建立 DOM 元素的共用小工具                   |
| `js/lab-scenarios.js`    | Git 練習場的題目與起始狀態                  |
| `js/git-lab.js`          | Git 練習場的畫面                            |
| `tests/git-sim.test.mjs` | 模擬器回歸測試                              |
| `tests/deck.test.mjs`    | 情境、任務、資源與流程整合檢查              |
| `tests/lab.test.mjs`     | 練習場每個題目都能建立、建議指令都能執行    |
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

模擬器是教學用的簡化版 Git：

- hash 是教學用識別碼；clone 載入固定示範快照；gh 不連線，也不開啟真實網頁。
- 同一個檔案兩邊都改時，merge 直接採用合入分支的內容並說明，沒有衝突編輯器；rebase 不處理衝突。
- 只支援 help 列出的指令與主要選項，不包含 interactive rebase、stash、cherry-pick、reflog、force push。
- 練習場使用「graph mode」：直接打 `git commit` 就會產生新 commit（真實 Git 需要有修改，或加上 `--allow-empty`）。
- 練習狀態重新整理後就消失。後悔藥任務按「重設」會保留打勾，方便比較三種 reset。
- commit 圖中虛線的 commit 代表沒有任何分支、tag 或 HEAD 指著（例如 reset、rebase、刪分支之後），對應真實 Git 只能靠 reflog 找回的情況。

安裝指令可能隨版本更新，教之前建議對照 [Claude Code 官方文件](https://code.claude.com/docs) 確認。
