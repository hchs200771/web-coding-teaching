// Git 練習場的畫面：任務面板 + 模擬終端機 + 三區 + commit graph。
// 真正的 Git 邏輯都在 git-sim.js，這裡只負責「畫出來」。

import { createSimulator } from './git-sim.js';
import { MISSIONS } from './missions.js';
import { initCopy } from './copy.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const COLUMN = 92; // 兩個 commit 圓點的水平距離
const LANE = 56; // 兩條分支線的垂直距離
const TOP = 40; // 第一條線上方留給分支標籤的空間

function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function svg(tag, attributes, text) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

const shorten = (text, length) => (text.length > length ? `${text.slice(0, length - 1)}…` : text);

// 幫每個 commit 決定位置：依建立順序由左到右。
// main 的歷史固定在最上面那條線，其他分支的 commit 往下排。
function layoutCommits(commits, mainTip) {
  const sorted = Object.values(commits).sort((a, b) => a.order - b.order);
  const mainLine = new Set();
  for (let id = mainTip; id && commits[id]; id = commits[id].parents[0]) mainLine.add(id);

  const positions = {};
  const laneTaken = {}; // parentId -> 這個 parent 的那條線是否已被某個 child 接走
  let lanes = 1;

  sorted.forEach((commit, index) => {
    const parent = commit.parents[0];
    let lane = 0;
    if (!mainLine.has(commit.id) && parent && positions[parent]) {
      const canContinue = !mainLine.has(parent) && !laneTaken[parent];
      lane = canContinue ? positions[parent].lane : lanes++;
      laneTaken[parent] = true;
    } else if (!mainLine.has(commit.id) && mainLine.size) {
      lane = lanes++; // 沒有 parent 可接（例如還沒 fetch 的遠端 commit）
    }
    positions[commit.id] = { x: 50 + index * COLUMN, lane, y: TOP + lane * LANE };
  });

  return { sorted, positions, lanes };
}

// 把 { 分支名: commitId } 轉成 { commitId: [標籤...] }
function labelsByCommit(groups) {
  const result = {};
  for (const { refs, format, className } of groups) {
    for (const [name, id] of Object.entries(refs)) {
      if (!id) continue;
      (result[id] ||= []).push({ text: format(name), className });
    }
  }
  return result;
}

function drawGraph({ title, commits, mainTip, labels, reachable, emptyText }) {
  const panel = make('div', 'graph-panel');
  panel.append(make('h4', '', title));

  const { sorted, positions, lanes } = layoutCommits(commits, mainTip);
  if (!sorted.length) {
    panel.append(make('p', 'muted', emptyText));
    return panel;
  }

  const width = Math.max(360, sorted.length * COLUMN + 60);
  const height = TOP + (lanes - 1) * LANE + 48;
  const graph = svg('svg', {
    viewBox: `0 0 ${width} ${height}`,
    width,
    height,
    role: 'img',
    'aria-label': title,
  });

  // 先畫連線，圓點才會蓋在線上面
  for (const commit of sorted) {
    for (const parentId of commit.parents) {
      const from = positions[parentId];
      const to = positions[commit.id];
      if (!from) continue;
      const lost = !reachable.has(commit.id);
      graph.append(
        svg('path', {
          d: `M ${from.x} ${from.y} C ${from.x + COLUMN / 2} ${from.y}, ${to.x - COLUMN / 2} ${to.y}, ${to.x} ${to.y}`,
          class: `commit-link${lost ? ' lost' : ''}`,
        }),
      );
    }
  }

  let hasLost = false;
  for (const commit of sorted) {
    const { x, y } = positions[commit.id];
    const lost = !reachable.has(commit.id);
    hasLost ||= lost;

    const group = svg('g', { class: `commit-node${lost ? ' lost' : ''}` });
    const circle = svg('circle', { cx: x, cy: y, r: 13 });
    circle.append(svg('title', {}, `${commit.id}：${commit.message}${lost ? '（已不在任何分支上）' : ''}`));
    group.append(circle);
    group.append(svg('text', { x, y: y + 28, 'text-anchor': 'middle', class: 'commit-hash' }, commit.id));
    group.append(
      svg(
        'text',
        { x, y: y + 41, 'text-anchor': 'middle', class: 'commit-message' },
        shorten(commit.message, 11),
      ),
    );

    (labels[commit.id] || []).forEach((label, i) => {
      group.append(
        svg('text', { x, y: y - 20 - i * 13, 'text-anchor': 'middle', class: label.className }, label.text),
      );
    });
    graph.append(group);
  }

  panel.append(graph);
  if (hasLost)
    panel.append(make('p', 'lost-note', '虛線的 commit 已不在任何分支上（真實 Git 可用 git reflog 找回）'));
  return panel;
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

function createSandbox(root, number) {
  const mission = MISSIONS[root.dataset.mission];
  let sim = createSimulator(root.dataset.scenario);
  const completed = new Set();
  let recall = [];
  let recallIndex = 0;
  let draft = '';

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
  const terminal = make('div', 'terminal');
  const history = make('div', 'terminal-history');
  history.setAttribute('role', 'log');
  history.setAttribute('aria-label', '指令輸出');

  const form = make('form', 'terminal-form');
  const input = make('input');
  input.id = `git-input-${number}`;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.placeholder = '輸入指令，例如 git status';
  input.setAttribute('aria-label', '輸入模擬指令');
  input.setAttribute('autocapitalize', 'off');
  const sendButton = make('button', '', '執行');
  sendButton.type = 'submit';
  form.append(make('span', 'terminal-prompt', '❯'), input, sendButton);
  terminal.append(
    make('div', 'terminal-title', '● ● ●　練習終端機（純模擬，不會動到你的電腦）'),
    history,
    form,
  );

  // ---- 右側視覺化 ----
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
  const graphs = make('div', 'git-graphs');
  const colleagueButton = make('button', 'colleague-button', '模擬同事推了一個 commit 到 GitHub');
  colleagueButton.type = 'button';
  visual.append(areas, graphs, colleagueButton);

  const body = make('div', 'sandbox-body');
  body.append(terminal, visual);
  root.append(panel, body);

  // ---- 畫面更新 ----
  function print(text, isCommand = false) {
    history.append(make('pre', isCommand ? 'terminal-command' : 'terminal-output', text));
    while (history.children.length > 150) history.firstChild.remove();
    history.scrollTop = history.scrollHeight;
  }

  function renderAreas(state) {
    const head = state.commits[state.branches[state.branch]]?.files || {};
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

  function renderGraphs(state) {
    const localLabels = labelsByCommit([
      {
        refs: state.branches,
        format: name => (name === state.branch ? `${name} ← HEAD` : name),
        className: 'branch-label',
      },
      { refs: state.remoteTracking, format: name => `origin/${name}`, className: 'remote-label' },
    ]);
    graphs.replaceChildren(
      drawGraph({
        title: '本地 commit 歷史',
        commits: state.commits,
        mainTip: state.branches.main ?? state.branches[state.branch],
        labels: localLabels,
        reachable: sim.reachableCommits(),
        emptyText: state.initialized ? '還沒有 commit' : '還不是 Git 儲存庫（試試 git init）',
      }),
    );

    if (state.remote) {
      const remoteCommits = state.remote.commits;
      graphs.append(
        drawGraph({
          title: 'GitHub 上的 origin',
          commits: remoteCommits,
          mainTip: state.remote.branches.main,
          labels: labelsByCommit([
            { refs: state.remote.branches, format: name => name, className: 'branch-label' },
          ]),
          reachable: new Set(Object.keys(remoteCommits)),
          emptyText: '遠端是空的，還沒 push 過',
        }),
      );
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
    renderGraphs(state);
    renderMission(state);
    colleagueButton.hidden = !sim.hasRemote();
  }

  function run(command) {
    print(`❯ ${command}`, true);
    const output = sim.run(command);
    if (command === 'clear') history.replaceChildren();
    else if (output) print(output);
    render();
  }

  // ---- 事件 ----
  form.addEventListener('submit', event => {
    event.preventDefault();
    const command = input.value.trim();
    if (!command) return;
    recall.push(command);
    recallIndex = recall.length;
    input.value = '';
    draft = '';
    run(command);
    input.focus({ preventScroll: true });
  });

  // ↑ ↓ 叫回之前輸入過的指令（跟真的終端機一樣）
  input.addEventListener('keydown', event => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    event.stopPropagation();
    if (recallIndex === recall.length) draft = input.value;
    const delta = event.key === 'ArrowUp' ? -1 : 1;
    recallIndex = Math.max(0, Math.min(recall.length, recallIndex + delta));
    input.value = recallIndex === recall.length ? draft : recall[recallIndex];
  });

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
    recall = [];
    recallIndex = 0;
    history.replaceChildren();
    hintOutput.textContent = '';
    print('情境已重設。輸入 help 看可用指令。');
    render();
  });

  colleagueButton.addEventListener('click', () => {
    print(sim.colleaguePush());
    render();
  });

  print('歡迎！先看上方任務，卡住就按「提示」。輸入 help 可查看指令。');
  render();
}

export function initGitUI() {
  document.querySelectorAll('.git-sandbox').forEach(createSandbox);
}
