// 每個任務 = 標題 + 目標 + 步驟。
// 步驟的 check 會收到模擬器 state，回傳 true 就打勾。
// check 可以是事件名稱（字串），也可以是函式。

const hasEvent = name => state => state.events.has(name);

const step = (text, hint, check) => ({
  text,
  hint,
  check: typeof check === 'string' ? hasEvent(check) : check,
});

// index.html 跟目前分支最新 commit 的內容不同（代表有修改），或改完已經 commit
const editedIndexHtml = state => {
  const head = state.commits[state.branches[state.branch]];
  return state.files['index.html'] !== head?.files['index.html'] || state.events.has('commit');
};

const onNewFeatureBranch = state => state.branch === 'feature' && state.events.has('branch-create');

export const MISSIONS = {
  'first-commit': {
    title: '第一次 commit',
    goal: '資料夾裡有 README.md、index.html、style.css，把它們變成第一個存檔點。',
    steps: [
      step('建立 Git 儲存庫', 'git init', 'init'),
      step('加入暫存區', 'git add .', 'add'),
      step('留下第一個 commit', 'git commit -m "建立首頁"', 'commit'),
    ],
  },

  'next-commit': {
    title: '修改後再 commit',
    goal: '看清楚改了什麼，再留下新版本。',
    steps: [
      step('修改 index.html', 'echo "新的首頁" >> index.html', editedIndexHtml),
      step('查看狀態', 'git status', 'status'),
      step('查看差異', 'git diff', 'diff'),
      step('暫存修改', 'git add .', 'add'),
      step('新增 commit', 'git commit -m "更新首頁"', 'commit'),
      step('查看歷史', 'git log --oneline', 'log'),
    ],
  },

  branch: {
    title: '分支練習',
    goal: '在 feature 分支修改 index.html，再合併回 main。',
    steps: [
      step('建立並切換到 feature', 'git switch -c feature', onNewFeatureBranch),
      step('修改 index.html', 'echo "分支的新內容" >> index.html', editedIndexHtml),
      step(
        '在分支留下 commit',
        'git commit -am "加入新內容"',
        state => state.branch === 'feature' && state.events.has('commit'),
      ),
      step('切回 main', 'git switch main', 'switch-main'),
      step('合併 feature', 'git merge feature', 'merge'),
    ],
  },

  push: {
    title: '把新作品推上 GitHub',
    goal: '先推送一次，再修改、存檔，把新版本也推上去。',
    steps: [
      step('設定 origin', 'git remote add origin git@github.com:demo/my-site.git', 'remote-add'),
      step('第一次 push', 'git push -u origin main', 'push'),
      step('修改首頁', 'echo "新的作品照片" >> index.html', editedIndexHtml),
      step('放上拍照台', 'git add .', 'add'),
      step('存檔', 'git commit -m "新增作品照片"', 'commit'),
      step(
        '把新存檔推上 GitHub',
        'git push',
        state => state.events.has('commit') && state.events.has('push') &&
          state.remote?.branches.main === state.branches.main,
      ),
    ],
  },

  undo: {
    title: '後悔藥實驗室',
    goal: '每試完一種 reset 就按「重設」回到三個 commit（打勾會保留），比較三區的差別。',
    steps: [
      step('試 soft：保留暫存與檔案', 'git reset --soft HEAD~1', 'reset-soft'),
      step('試 mixed：保留檔案，取消暫存', 'git reset --mixed HEAD~1', 'reset-mixed'),
      step('試 hard：三區一起回到舊版本', 'git reset --hard HEAD~1', 'reset-hard'),
      step('修改檔案，再用 restore 還原', 'echo "試改" >> index.html\ngit restore index.html', 'restore'),
      step('用新 commit 撤銷舊 commit', 'git revert HEAD', 'revert'),
    ],
  },

  remote: {
    title: '推上 GitHub',
    goal: '推送本機版本，再處理同事的遠端更新。',
    steps: [
      step('設定 origin', 'git remote add origin https://github.com/demo/my-site.git', 'remote-add'),
      step('第一次 push', 'git push -u origin main', 'push'),
      step('按「模擬同事推了一個 commit」', null, 'colleague'),
      step(
        '自己也 commit，再 push，看到拒絕訊息',
        'echo "我的修改" >> index.html\ngit commit -am "我的修改"\ngit push',
        'push-rejected',
      ),
      step('整合遠端更新', 'git pull', 'pull'),
      step(
        '再次成功 push',
        'git push',
        state => state.events.has('push-after-pull') && state.remote?.branches.main === state.branches.main,
      ),
    ],
  },

  gh: {
    title: 'gh 流程',
    goal: '在分支修改，開 PR，合併後同步 main。',
    steps: [
      step('確認登入', 'gh auth status', state => state.loggedIn && state.events.has('auth-status')),
      step('開 feature 分支', 'git switch -c feature', onNewFeatureBranch),
      step('修改首頁並 commit', 'echo "PR 更新" >> index.html\ngit commit -am "更新首頁"', 'commit'),
      step('推送 feature', 'git push -u origin feature', state => !!state.remote?.branches.feature),
      step('建立 Pull Request', 'gh pr create --title "更新首頁" --body "加入新內容"', 'pr-create'),
      step('合併 PR', 'gh pr merge 1 --merge', 'pr-merge'),
      step('切回 main', 'git switch main', 'switch-main'),
      step('同步合併結果', 'git pull', 'pull'),
    ],
  },

  free: {
    title: '自由練習',
    goal: '這是模擬環境，輸入 help 看指令，放心亂試。',
    steps: [],
  },
};
