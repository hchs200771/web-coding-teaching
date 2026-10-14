// Git 練習場：選一個題目 → 在終端機打指令 → 看 commit 圖怎麼變。
// 版面參考「為你自己學 Git」的 Git 練習場（gitbook.tw/playground）。

import { LAB_GROUPS, LAB_SCENARIOS, createLabSimulator } from './lab-scenarios.js';
import { createTerminal } from './terminal.js';
import { createGitGraphs } from './git-graphs.js';
import { make } from './dom.js';

function createLab(root) {
  let scenario = LAB_SCENARIOS[0];
  let sim;

  // ---- 題目按鈕 ----
  const picker = make('div', 'lab-picker');
  const scenarioButtons = new Map();
  for (const group of LAB_GROUPS) {
    const row = make('div', 'lab-picker-row');
    row.append(make('span', 'lab-picker-label', group.label));
    for (const item of LAB_SCENARIOS.filter(entry => entry.group === group.id)) {
      const button = make('button', '', item.name);
      button.type = 'button';
      button.addEventListener('click', () => load(item));
      scenarioButtons.set(item.id, button);
      row.append(button);
    }
    picker.append(row);
  }

  // ---- 終端機 ----
  const terminal = createTerminal({
    title: 'TERMINAL',
    placeholder: '輸入 git 指令…',
    onCommand(command) {
      const output = sim.run(command);
      if (command === 'clear') terminal.clear();
      else if (output) terminal.print(output, output.startsWith('錯誤') ? 'error' : 'output');
      render();
    },
  });

  // ---- 圖 ----
  const board = make('div', 'lab-board');
  const boardHeader = make('div', 'lab-board-header');
  const boardTitle = make('span', 'lab-board-title');
  const restartButton = make('button', 'lab-restart', '重來 ↺');
  restartButton.type = 'button';
  restartButton.addEventListener('click', () => load(scenario));
  boardHeader.append(boardTitle, restartButton);

  const graphs = createGitGraphs({
    localTitle: '本機',
    remoteTitle: 'GitHub（origin）',
    showMessages: false,
  });
  const graphBox = make('div', 'lab-graphs');
  graphBox.append(graphs.local, graphs.remote);
  board.append(boardHeader, graphBox);

  // ---- 試試看 ----
  const tryRow = make('div', 'lab-try');

  const main = make('div', 'lab-main');
  main.append(terminal.element, board);
  root.append(picker, main, tryRow, graphs.legend);

  function render() {
    graphBox.classList.toggle('has-remote', graphs.render(sim));
  }

  function load(item) {
    scenario = item;
    sim = createLabSimulator(item.id);
    for (const [id, button] of scenarioButtons) button.classList.toggle('selected', id === item.id);
    boardTitle.textContent = `${item.name.toUpperCase()} · ${item.title}`;
    terminal.setBadge(item.name.toUpperCase());
    terminal.clear();
    terminal.print(item.intro, 'intro');
    graphs.reset();

    tryRow.replaceChildren(make('span', 'lab-try-label', '試試看（點一下會填進終端機，再按 Enter）：'));
    for (const command of item.try) {
      const chip = make('button', 'lab-chip', command);
      chip.type = 'button';
      chip.addEventListener('click', () => terminal.fill(command));
      tryRow.append(chip);
    }
    render();
  }

  load(scenario);
}

export function initGitLab() {
  document.querySelectorAll('.git-lab').forEach(createLab);
}
