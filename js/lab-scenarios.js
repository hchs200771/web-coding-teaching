// Git 練習場的題目。每一題 = 起始狀態（用一串指令建出來）+ 說明 + 建議試試的指令。
// 只看 commit 圖，所以用 graphMode：直接打 git commit 就會長出新 commit。

import { createSimulator } from './git-sim.js';

const REMOTE = 'git remote add origin https://github.com/demo/playground.git';
const COLLEAGUE = '@colleague'; // 特殊指令：模擬同事推了一個 commit 到 GitHub

export const LAB_GROUPS = [
  { id: 'local', label: 'LOCAL' },
  { id: 'remote', label: 'REMOTE' },
  { id: 'other', label: 'OTHER' },
];

export const LAB_SCENARIOS = [
  {
    id: 'commit',
    group: 'local',
    name: 'Commit',
    title: '建立 commit',
    intro:
      '試著輸入幾次 git commit，看看會有什麼變化：每個新 commit 都指回上一個，main 和 HEAD 會跟著往前走。',
    setup: ['git commit'],
    try: ['git commit'],
  },
  {
    id: 'branch',
    group: 'local',
    name: 'Branch',
    title: '建立分支',
    intro:
      '用 git branch feature 建立分支：分支只是一張貼在 commit 上的標籤。接著 git commit，看看哪張標籤會往前走？（答案：HEAD 所在的那張）',
    setup: ['git commit', 'git commit'],
    try: ['git branch feature', 'git commit', 'git branch'],
  },
  {
    id: 'checkout',
    group: 'local',
    name: 'Checkout',
    title: '切換分支與 detached HEAD',
    intro:
      'git checkout feature 會把 HEAD 移到 feature。也可以 checkout 某個 commit（例如 HEAD~1 或圖上的 hash），這時 HEAD 沒有跟著分支，叫 detached HEAD。',
    setup: [
      'git commit',
      'git branch feature',
      'git commit',
      'git switch feature',
      'git commit',
      'git switch main',
    ],
    try: ['git checkout feature', 'git checkout HEAD~1', 'git commit', 'git checkout main'],
  },
  {
    id: 'merge',
    group: 'local',
    name: 'Merge',
    title: '用 merge 合併',
    intro:
      '現在在 main，develop 分岔出去做了兩個 commit。輸入 git merge develop，會產生一個有兩個 parent 的 merge commit（橘色圈）。',
    setup: [
      'git commit',
      'git switch -c develop',
      'git commit',
      'git commit',
      'git switch main',
      'git commit',
    ],
    try: ['git merge develop'],
  },
  {
    id: 'rebase',
    group: 'local',
    name: 'Rebase',
    title: '用 rebase 合併',
    intro:
      '現在在 develop。輸入 git rebase main：develop 的 commit 會被「複製」一份接到 main 後面（hash 不一樣了），原本的 commit 沒有分支指著，會變淡。',
    setup: [
      'git commit',
      'git branch develop',
      'git commit',
      'git commit',
      'git switch develop',
      'git commit',
      'git commit',
      'git commit',
    ],
    try: ['git rebase main', 'git checkout main', 'git merge develop'],
  },
  {
    id: 'reset',
    group: 'local',
    name: 'Reset',
    title: '用 reset 回到過去',
    intro:
      'git reset HEAD~2 把 main 往回拉兩步，後面的 commit 沒有分支指著了（變淡）。它們其實還在，用 git reset 加圖上的 hash 就能拉回來。',
    setup: ['git commit', 'git commit', 'git commit', 'git commit'],
    try: ['git reset HEAD~2', 'git log --oneline'],
  },
  {
    id: 'revert',
    group: 'local',
    name: 'Revert',
    title: '用 revert 撤銷',
    intro:
      'git revert HEAD 不改寫歷史，而是新增一個「做相反動作」的 commit。已經 push 出去的 commit 要撤銷，用這個最安全。',
    setup: ['git commit', 'git commit', 'git commit'],
    try: ['git revert HEAD'],
  },
  {
    id: 'delete-branch',
    group: 'local',
    name: 'Delete Branches',
    title: '刪除分支',
    intro:
      'feature 還沒合併，git branch -d feature 會被拒絕；確定不要了就用 -D 強制刪除，它的 commit 會變成沒有分支指著。',
    setup: [
      'git commit',
      'git switch -c feature',
      'git commit',
      'git commit',
      'git switch main',
      'git commit',
    ],
    try: ['git branch -d feature', 'git branch -D feature'],
  },
  {
    id: 'tag',
    group: 'local',
    name: 'Tag',
    title: '貼上版本標籤',
    intro: 'tag 跟分支一樣是貼在 commit 上的標籤，但它不會跟著往前走，常用來標記發佈版本。',
    setup: ['git commit', 'git commit', 'git commit'],
    try: ['git tag v1.0', 'git commit', 'git tag v0.9 HEAD~2'],
  },
  {
    id: 'fetch',
    group: 'remote',
    name: 'Fetch',
    title: '用 fetch 取得遠端更新',
    intro:
      '同事在 GitHub 上多推了兩個 commit。git fetch 只會把它們下載下來、移動 origin/main（米色標籤），你的 main 不動。',
    setup: ['git commit', 'git commit', REMOTE, 'git push -u origin main', COLLEAGUE, COLLEAGUE],
    try: ['git fetch', 'git merge origin/main'],
  },
  {
    id: 'pull',
    group: 'remote',
    name: 'Pull',
    title: '用 pull 同步',
    intro: 'git pull = git fetch + git merge。一個指令就讓 main 跟上 GitHub。',
    setup: ['git commit', 'git commit', REMOTE, 'git push -u origin main', COLLEAGUE, COLLEAGUE],
    try: ['git pull'],
  },
  {
    id: 'push',
    group: 'remote',
    name: 'Push',
    title: '用 push 上傳',
    intro:
      '本機比 GitHub 多了兩個 commit。git push 把它們送上去，GitHub 的 main 和你的 origin/main 都會跟上。',
    setup: ['git commit', REMOTE, 'git push -u origin main', 'git commit', 'git commit'],
    try: ['git push'],
  },
  {
    id: 'push-rejected',
    group: 'remote',
    name: 'Push 被拒',
    title: '兩邊都有新 commit',
    intro: '你和同事都改了 main。直接 git push 會被拒絕；先 git pull 把同事的 commit 合進來，再 push。',
    setup: ['git commit', REMOTE, 'git push -u origin main', COLLEAGUE, 'git commit'],
    try: ['git push', 'git pull', 'git push'],
  },
  {
    id: 'free',
    group: 'other',
    name: '自由模式',
    title: '自由模式',
    intro: '所有指令都可以試，輸入 help 看清單。想重新開始就按右上角「重來」。',
    setup: ['git commit'],
    try: [
      'git commit',
      'git switch -c feature',
      'git switch main',
      'git merge feature',
      'git rebase main',
      'help',
    ],
  },
];

// 建立某一題的模擬器，跑完 setup 後清掉事件紀錄，讓畫面從「乾淨的起點」開始
export function createLabSimulator(id) {
  const scenario = LAB_SCENARIOS.find(item => item.id === id) || LAB_SCENARIOS[0];
  const sim = createSimulator('empty', { graphMode: true });
  sim.run('git init');
  for (const command of scenario.setup) {
    const output = command === COLLEAGUE ? sim.colleaguePush() : sim.run(command);
    if (output.startsWith('錯誤')) throw new Error(`練習場題目 ${id} 設定失敗：${command} → ${output}`);
  }
  sim.state.events.clear();
  return sim;
}
