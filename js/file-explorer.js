// 檔案瀏覽器：像編輯器側邊欄一樣，左邊點檔名、右邊看內容。
// 檔案有還沒 commit 的改動時，下方多一塊「跟最新 commit 比」的差異（+ 綠色、- 紅色）。

import { make } from './dom.js';

// 檔名旁邊的小標記，跟 VS Code 的 Git 標記一樣：U 未追蹤、M 已修改、D 已刪除
function badgeFor(name, state, head) {
  if (!(name in state.files)) return { text: 'D', title: '已刪除', kind: 'deleted' };
  if (!(name in state.index) && !(name in head))
    return { text: 'U', title: '新檔案，還沒被追蹤', kind: 'new' };
  if (state.files[name] !== head[name] || state.index[name] !== head[name])
    return { text: 'M', title: '跟最新 commit 不一樣', kind: 'modified' };
  return null;
}

// 這個檔案現在在 Git 流程的哪一步；跟最新 commit 一樣就回傳 null（不顯示）
function statusFor(name, state, head) {
  const work = state.files[name];
  const staged = state.index[name];
  const committed = head[name];
  if (work === committed && staged === committed) return null;
  if (!(name in state.index) && !(name in head)) return '新檔案・還沒 git add（Git 還沒開始追蹤它）';
  if (work !== staged) return `${!(name in state.files) ? '已刪除' : '已修改'}・還沒 git add`;
  return '已 git add・等著 commit';
}

// 逐行比較（LCS），回傳 [{ sign: ' ' | '+' | '-', text }]
function diffLines(before, after) {
  const a = before === undefined ? [] : before.replace(/\n$/, '').split('\n');
  const b = after === undefined ? [] : after.replace(/\n$/, '').split('\n');
  const lengths = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      lengths[i][j] =
        a[i] === b[j] ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);

  const result = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      result.push({ sign: ' ', text: a[i++] });
      j++;
    } else if (j < b.length && (i === a.length || lengths[i][j + 1] >= lengths[i + 1][j])) {
      result.push({ sign: '+', text: b[j++] });
    } else {
      result.push({ sign: '-', text: a[i++] });
    }
  }
  return result;
}

export function createFileExplorer() {
  const element = make('details', 'file-explorer');
  const summary = make('summary', '', '📂 檔案瀏覽器：點檔名看內容');
  const body = make('div', 'file-explorer-body');
  const list = make('ul', 'file-list');
  const viewer = make('div', 'file-viewer');
  const status = make('div', 'file-status-line');
  const content = make('pre', 'file-content');
  const diffBox = make('div', 'file-diff');
  viewer.append(status, content, diffBox);
  body.append(list, viewer);
  element.append(summary, body);

  let selected = null;
  let lastState = null;
  let lastHead = null;

  function drawList(names, state, head) {
    list.replaceChildren();
    for (const name of names) {
      const item = make('li');
      const button = make('button', name === selected ? 'selected' : '');
      button.type = 'button';
      const icon = name.endsWith('.html') ? '🌐' : name.endsWith('.css') ? '🎨' : '📄';
      button.append(make('span', 'file-icon', icon), make('span', 'file-list-name', name));
      const badge = badgeFor(name, state, head);
      if (badge) {
        const mark = make('span', `file-badge ${badge.kind}`, badge.text);
        mark.title = badge.title;
        button.append(mark);
      }
      button.addEventListener('click', () => {
        selected = name;
        draw();
      });
      item.append(button);
      list.append(item);
    }
    if (!names.length) list.append(make('li', 'muted', '（沒有檔案）'));
  }

  function drawViewer(state, head) {
    const statusText = selected ? statusFor(selected, state, head) : null;
    status.hidden = !statusText;
    status.textContent = statusText || '';

    // 主要內容：跟編輯器一樣，顯示檔案現在的樣子
    const deleted = selected && !(selected in state.files);
    content.classList.toggle('missing', !selected || deleted);
    if (!selected) content.textContent = '';
    else if (deleted) content.textContent = `（${selected} 已經被刪除）`;
    else content.textContent = state.files[selected] || '（空檔案）';

    // 有還沒 commit 的改動時，才顯示差異
    diffBox.replaceChildren();
    diffBox.hidden = !statusText;
    if (!statusText) return;
    diffBox.append(make('div', 'file-diff-title', '跟最新 commit 比，改了這些：'));
    const pre = make('pre');
    for (const line of diffLines(head[selected], state.files[selected])) {
      if (line.sign === ' ') continue; // 只列出有變動的行
      pre.append(make('span', line.sign === '+' ? 'added' : 'removed', `${line.sign} ${line.text}\n`));
    }
    diffBox.append(pre);
  }

  function draw() {
    const state = lastState;
    const head = lastHead;
    const names = [
      ...new Set([...Object.keys(state.files), ...Object.keys(state.index), ...Object.keys(head)]),
    ].sort();
    if (!names.includes(selected)) selected = names[0] ?? null;
    drawList(names, state, head);
    drawViewer(state, head);
  }

  return {
    element,
    update(state, head) {
      lastState = state;
      lastHead = head;
      draw();
    },
  };
}

export { diffLines };
