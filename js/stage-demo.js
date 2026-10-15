// 用簡單的動畫，示範工作目錄、暫存區和儲存庫的變化。

import { make } from './dom.js';
import { initCopy } from './copy.js';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const FILES = {
  'index.html': { label: 'index.html', kind: 'modified' },
  '作品照片.jpg': { label: '作品照片.jpg', kind: 'new' },
  'style.css': { label: 'style.css', kind: 'modified' },
};
const MESSAGES = ['更新首頁', '加入作品照片', '調整網站樣式', '完成網站修改'];

function createStageDemo(root) {
  const working = new Map();
  const staged = new Map();
  const commits = [{ number: 1, message: '建立網站', files: [] }];
  let nextMessage = 0;
  let busy = false;
  const reducedMotion = () => window.matchMedia(REDUCED_MOTION).matches;

  root.classList.add('stage-demo');
  const areas = make('div', 'stage-demo__areas');
  const areaLists = {};
  const areaBoxes = {};
  const areaSpecs = [
    { key: 'work', title: '📁 工作目錄', note: '你的桌面：正在改的檔案' },
    { key: 'stage', title: '📸 暫存區', note: '拍照台：這次要拍進去的檔案' },
    { key: 'repo', title: '📚 儲存庫', note: '相簿：每次存檔的照片' },
  ];
  for (const { key, title, note } of areaSpecs) {
    const box = make('section', `stage-demo__area stage-demo__area--${key}`);
    box.append(make('h3', 'stage-demo__area-title', title), make('p', 'stage-demo__area-note', note));
    const list = make('div', `stage-demo__list stage-demo__list--${key}`);
    box.append(list);
    areas.append(box);
    areaLists[key] = list;
    areaBoxes[key] = box;
  }

  const editControls = make('div', 'stage-demo__controls stage-demo__controls--edit');
  const actionControls = make('div', 'stage-demo__controls stage-demo__controls--git');
  const editButtons = {};
  for (const [name, text] of [
    ['index.html', '✏️ 修改 index.html'],
    ['作品照片.jpg', '✏️ 新增 作品照片.jpg'],
    ['style.css', '✏️ 修改 style.css'],
  ]) {
    const button = make('button', 'stage-demo__button', text);
    button.type = 'button';
    button.addEventListener('click', async () => {
      if (busy) return;
      await editFile(name);
    });
    editButtons[name] = button;
    editControls.append(button);
  }
  const addIndexButton = make('button', 'stage-demo__button', 'git add index.html');
  const addAllButton = make('button', 'stage-demo__button', 'git add .');
  const commitButton = make('button', 'stage-demo__button stage-demo__button--primary', 'git commit');
  const resetButton = make('button', 'stage-demo__button', '重來');
  for (const button of [addIndexButton, addAllButton, commitButton, resetButton]) button.type = 'button';
  addIndexButton.addEventListener('click', () => addFiles(['index.html'], 'git add index.html'));
  addAllButton.addEventListener('click', () => addFiles([...working.keys()], 'git add .'));
  commitButton.addEventListener('click', commit);
  resetButton.addEventListener('click', reset);
  actionControls.append(addIndexButton, addAllButton, commitButton, resetButton);

  const caption = make('p', 'stage-demo__caption', '目前沒有待處理的修改。');
  caption.setAttribute('aria-live', 'polite');
  const terminal = make('div', 'stage-demo__terminal');
  terminal.setAttribute('aria-label', '對應的 PowerShell 指令');
  const terminalPre = make('pre', 'cmd');
  const terminalCode = make('code', '', 'git status');
  terminalPre.append(terminalCode);
  terminal.append(make('span', '', 'PS C:\\my-site>'), terminalPre);
  root.replaceChildren(areas, editControls, actionControls, caption, terminal);

  function chip(name, kind, area) {
    const element = make('div', `stage-demo__file stage-demo__file--${kind}`);
    element.dataset.file = name;
    element.dataset.area = area;
    element.append(make('span', 'stage-demo__file-name', name));
    element.append(make('small', 'stage-demo__file-status', kind === 'new' ? '新檔案' : '已修改'));
    return element;
  }

  function commitCard(item, pending = false) {
    const card = make('article', `stage-demo__commit${pending ? ' stage-demo__commit--pending' : ''}`);
    card.dataset.commit = item.number;
    card.append(make('strong', 'stage-demo__commit-title', `📸 #${item.number} ${item.message}`));
    if (item.files.length) card.append(make('small', 'stage-demo__commit-files', item.files.join('、')));
    return card;
  }

  function render() {
    areaLists.work.replaceChildren();
    areaLists.stage.replaceChildren();
    areaLists.repo.replaceChildren();
    for (const [name, kind] of working) areaLists.work.append(chip(name, kind, 'work'));
    for (const [name, kind] of staged) areaLists.stage.append(chip(name, kind, 'stage'));
    commits.slice(0, 4).forEach(item => areaLists.repo.append(commitCard(item)));
    addIndexButton.disabled = !working.has('index.html') || busy;
    addAllButton.disabled = working.size === 0 || busy;
    commitButton.disabled = busy;
    resetButton.disabled = busy;
    Object.values(editButtons).forEach(button => { button.disabled = busy; });
  }

  function disableActions(disabled) {
    [addIndexButton, addAllButton, commitButton, resetButton, ...Object.values(editButtons)]
      .forEach(button => { button.disabled = disabled; });
  }

  function showCommand(command, explanation) {
    caption.textContent = explanation;
    terminalCode.textContent = command;
  }

  async function moveElement(element, destination, area) {
    const from = element.getBoundingClientRect();
    destination.querySelector(`[data-file="${CSS.escape(element.dataset.file)}"]`)?.remove();
    destination.append(element);
    element.dataset.area = area;
    if (reducedMotion()) return;
    const to = element.getBoundingClientRect();
    const dx = from.left - to.left;
    const dy = from.top - to.top;
    if (!dx && !dy) return;
    const animation = element.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
      { duration: 500, easing: 'ease', fill: 'none' },
    );
    try { await animation.finished; } catch { /* 重設時動畫可能被取消 */ }
  }

  async function editFile(name) {
    busy = true;
    const { kind } = FILES[name];
    working.set(name, kind);
    render();
    const element = areaLists.work.querySelector(`[data-file="${CSS.escape(name)}"]`);
    if (element && !reducedMotion()) {
      element.animate(
        [{ opacity: 0, transform: 'scale(.86)' }, { opacity: 1, transform: 'scale(1)' }],
        { duration: 220, easing: 'ease-out' },
      );
    }
    showCommand('git status', `${name} 有修改，出現在工作目錄。用 git status 就能看到它。`);
    await new Promise(resolve => setTimeout(resolve, reducedMotion() ? 0 : 220));
    busy = false;
    render();
  }

  async function addFiles(names, command) {
    if (busy || !names.length) return;
    busy = true;
    disableActions(true);
    const elements = names
      .map(name => areaLists.work.querySelector(`[data-file="${CSS.escape(name)}"]`))
      .filter(Boolean);
    for (const name of names) {
      if (working.has(name)) staged.set(name, working.get(name));
      working.delete(name);
    }
    const moves = elements.map(element => moveElement(element, areaLists.stage, 'stage'));
    showCommand(command, names.length === 1
      ? `把 ${names[0]} 放上拍照台，準備存檔。`
      : `把 ${names.length} 個檔案放上拍照台，準備一起存檔。`);
    await Promise.all(moves);
    busy = false;
    render();
  }

  async function commit() {
    if (busy) return;
    if (!staged.size) {
      caption.textContent = '拍照台是空的，先 git add 再拍照';
      areaBoxes.stage.classList.remove('stage-demo__shake');
      if (!reducedMotion()) {
        void areaBoxes.stage.offsetWidth;
        areaBoxes.stage.classList.add('stage-demo__shake');
      }
      terminalCode.textContent = 'git commit';
      return;
    }

    busy = true;
    disableActions(true);
    const files = [...staged.keys()];
    const message = MESSAGES[nextMessage % MESSAGES.length];
    nextMessage += 1;
    const item = { number: commits[0].number + 1, message, files };
    const pendingCard = commitCard(item, true);
    areaLists.repo.prepend(pendingCard);
    const elements = [...areaLists.stage.querySelectorAll('.stage-demo__file')];
    const moves = elements.map(element => moveElement(element, pendingCard, 'repo'));
    showCommand(`git commit -m "${message}"`, '拍下這次修改，存成一個新的版本。');
    areaBoxes.stage.classList.add('stage-demo__flash');
    await Promise.all(moves);
    areaBoxes.stage.classList.remove('stage-demo__flash');
    staged.clear();
    commits.unshift(item);
    busy = false;
    render();
    if (!reducedMotion()) {
      const card = areaLists.repo.firstElementChild;
      card?.animate(
        [{ opacity: .2, transform: 'scale(.92)' }, { opacity: 1, transform: 'scale(1)' }],
        { duration: 260, easing: 'ease-out' },
      );
    }
  }

  function reset() {
    if (busy) return;
    working.clear();
    staged.clear();
    commits.splice(0, commits.length, { number: 1, message: '建立網站', files: [] });
    nextMessage = 0;
    areaBoxes.stage.classList.remove('stage-demo__flash', 'stage-demo__shake');
    caption.textContent = '目前沒有待處理的修改。';
    terminalCode.textContent = 'git status';
    render();
  }

  render();
  initCopy(root);
}

export function initStageDemo() {
  document.querySelectorAll('.stage-demo').forEach(createStageDemo);
}
