// 任務練習的畫面：任務面板 + 模擬終端機 + 三區 + commit 圖。
// 真正的 Git 邏輯都在 git-sim.js，這裡只負責「畫出來」。

import { createSimulator } from './git-sim.js';
import { MISSIONS } from './missions.js';
import { initCopy } from './copy.js';
import { createTerminal } from './terminal.js';
import { CommitGraph, createLegend } from './commit-graph.js';

function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function fileStatus(area, name, state, head) {
  if (area === 'work') {
    if (!(name in state.files)) return 'deleted';
    if (!(name in state.index) && !(name in head)) return 'untracked';
    return state.files[name] !== state.index[name] ? 'modified' : 'clean';
  }
  if (area === 'stage') {
    if (!(name in state.index)) return 'staged-deletion';
    return state.index[name] !== head[name] ? 'staged' : 'tracked';
  }
  return 'committed';
}

const STATUS_TEXT = {
  deleted: '已刪除',
  untracked: '未追蹤',
  modified: '已修改',
  clean: '沒變',
  'staged-deletion': '準備刪除',
  staged: '準備提交',
  tracked: '同上一版',
  committed: '已存檔',
};

// 把模擬器 state 轉成 commit 圖需要的資料（任務練習與練習場共用）
export function localGraphData(sim) {
  const { state } = sim;
  return {
    commits: state.commits,
    mainTip: state.branches.main ?? state.branches[state.branch],
    headId: state.detached ?? state.branches[state.branch],
    reachable: sim.reachableCommits(),
    refs: {
      branches: state.branches,
      currentBranch: state.branch,
      detached: state.detached,
      remoteBranches: state.remoteTracking,
      tags: state.tags,
    },
    emptyText: state.initialized ? '還沒有 commit' : '還不是 Git 儲存庫（試試 git init）',
  };
}

export function remoteGraphData(sim) {
  const { remote } = sim.state;
  return {
    commits: remote.commits,
    mainTip: remote.branches.main,
    headId: null,
    reachable: new Set(Object.keys(remote.commits)),
    refs: { branches: remote.branches },
    emptyText: '遠端是空的，還沒 push 過',
  };
}

function createSandbox(root) {
  const mission = MISSIONS[root.dataset.mission];
  let sim = createSimulator(root.dataset.scenario);
  const completed = new Set();

  // ---- 任務面板 ----
  const panel = make('div', 'mission-panel');
  const top = make('div', 'mission-top');
  const hintButton = make('button', '', '提示');
  const resetButton = make('button', '', '重設');
  hintButton.type = resetButton.type = 'button';
  top.append(make('h3', '', mission.title), make('p', 'mission-goal', mission.goal), hintButton, resetButton);

  const checklist = make('ul', 'mission-checklist');
  const checkRows = mission.steps.map(item => {
    const row = make('li', '', `○ ${item.text}`);
    checklist.append(row);
    return row;
  });
  const hintOutput = make('div', 'hint-output');
  hintOutput.setAttribute('aria-live', 'polite');
  panel.append(top);
  if (mission.steps.length) panel.append(checklist);
  panel.append(hintOutput);

  // ---- 終端機 ----
  const terminal = createTerminal({
    title: '練習終端機（純模擬，不會動到你的電腦）',
    onCommand(command) {
      const output = sim.run(command);
      if (command === 'clear') terminal.clear();
      else if (output) terminal.print(output, output.startsWith('錯誤') ? 'error' : 'output');
      render();
    },
  });

  // ---- 右側視覺化（不管深淺主題都是亮色） ----
  const visual = make('div', 'git-visual');
  const areas = make('div', 'git-areas');
  const areaLists = {};
  for (const [key, title, subtitle] of [
    ['work', '工作目錄', 'Working Directory'],
    ['stage', '暫存區', 'Staging Area'],
    ['repo', '本地儲存庫', 'Local Repo（HEAD）'],
  ]) {
    const box = make('div', `git-area area-${key}`);
    const heading = make('h4', '', title);
    heading.append(make('small', '', subtitle));
    areaLists[key] = make('ul');
    box.append(heading, areaLists[key]);
    areas.append(box);
  }
  const localGraph = new CommitGraph('本地 commit 歷史');
  const remoteGraph = new CommitGraph('GitHub 上的 origin');
  const colleagueButton = make('button', 'colleague-button', '模擬同事推了一個 commit 到 GitHub');
  colleagueButton.type = 'button';
  visual.append(areas, localGraph.element, remoteGraph.element, colleagueButton, createLegend());

  const body = make('div', 'sandbox-body');
  body.append(terminal.element, visual);
  root.append(panel, body);

  // ---- 畫面更新 ----
  function renderAreas(state) {
    const head = state.commits[state.detached ?? state.branches[state.branch]]?.files || {};
    const namesFor = {
      work: new Set([...Object.keys(state.files), ...Object.keys(state.index)]),
      stage: new Set([...Object.keys(state.index), ...Object.keys(head)]),
      repo: new Set(Object.keys(head)),
    };
    for (const [area, names] of Object.entries(namesFor)) {
      const list = areaLists[area];
      list.replaceChildren();
      if (!names.size) list.append(make('li', 'muted', '（空）'));
      for (const name of [...names].sort()) {
        const status = fileStatus(area, name, state, head);
        const row = make('li', `file-state ${status}`);
        row.append(make('span', 'file-name', name), make('span', 'file-status', STATUS_TEXT[status]));
        list.append(row);
      }
    }
  }

  function renderMission(state) {
    mission.steps.forEach((item, i) => {
      if (item.check(state)) completed.add(i);
      checkRows[i].textContent = `${completed.has(i) ? '✓' : '○'} ${item.text}`;
      checkRows[i].classList.toggle('done', completed.has(i));
    });
    if (mission.steps.length && completed.size === mission.steps.length) {
      hintOutput.textContent = '🎉 完成！你已經走過這個流程。';
    }
  }

  function render() {
    const { state } = sim;
    renderAreas(state);
    localGraph.update(localGraphData(sim));
    remoteGraph.element.hidden = !state.remote;
    if (state.remote) remoteGraph.update(remoteGraphData(sim));
    renderMission(state);
    colleagueButton.hidden = !sim.hasRemote();
  }

  // ---- 按鈕 ----
  hintButton.addEventListener('click', () => {
    const next = mission.steps.find((_, i) => !completed.has(i));
    hintOutput.replaceChildren();
    if (next?.hint) {
      const pre = make('pre', 'cmd');
      pre.append(make('code', '', next.hint));
      hintOutput.append(pre);
      initCopy(hintOutput);
    } else if (next) {
      hintOutput.textContent = '按右下角的「模擬同事推了一個 commit 到 GitHub」。';
    } else {
      hintOutput.textContent = '輸入 help 看所有指令，自由探索。';
    }
  });

  resetButton.addEventListener('click', () => {
    sim = createSimulator(root.dataset.scenario);
    // 後悔藥任務要反覆重設比較，所以保留打勾
    if (root.dataset.mission !== 'undo') completed.clear();
    terminal.clear();
    hintOutput.textContent = '';
    terminal.print('情境已重設。輸入 help 看可用指令。');
    render();
  });

  colleagueButton.addEventListener('click', () => {
    terminal.print(sim.colleaguePush());
    render();
  });

  terminal.print('歡迎！先看上方任務，卡住就按「提示」。輸入 help 可查看指令。');
  render();
}

export function initGitUI() {
  document.querySelectorAll('.git-sandbox').forEach(createSandbox);
}
