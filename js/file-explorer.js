// 檔案瀏覽器：像編輯器側邊欄一樣，左邊點檔名、右邊看內容。
// 還可以切換「工作目錄 / 暫存區 / 最新 commit」三個版本，看 add、commit 到底存了什麼。

function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

const VERSIONS = [
  { key: 'work', label: '工作目錄', pick: (state, head) => state.files },
  { key: 'stage', label: '暫存區', pick: (state, head) => state.index },
  { key: 'head', label: '最新 commit', pick: (state, head) => head },
];

// 檔名旁邊的小標記，跟 VS Code 的 Git 標記一樣：U 未追蹤、M 已修改、D 已刪除
function badgeFor(name, state, head) {
  if (!(name in state.files)) return { text: 'D', title: '已刪除', kind: 'deleted' };
  if (!(name in state.index) && !(name in head))
    return { text: 'U', title: '新檔案，還沒被追蹤', kind: 'new' };
  if (state.files[name] !== head[name] || state.index[name] !== head[name])
    return { text: 'M', title: '跟最新 commit 不一樣', kind: 'modified' };
  return null;
}

export function createFileExplorer() {
  const element = make('details', 'file-explorer');
  const summary = make('summary', '', '📂 檔案瀏覽器：點檔名看內容');
  const body = make('div', 'file-explorer-body');
  const list = make('ul', 'file-list');
  const viewer = make('div', 'file-viewer');
  const tabs = make('div', 'file-version-tabs');
  const content = make('pre', 'file-content');
  viewer.append(tabs, content);
  body.append(list, viewer);
  element.append(summary, body);

  let selected = null;
  let version = 'work';
  let lastState = null;
  let lastHead = null;

  const versionButtons = VERSIONS.map(item => {
    const button = make('button', '', item.label);
    button.type = 'button';
    button.addEventListener('click', () => {
      version = item.key;
      draw();
    });
    tabs.append(button);
    return [item.key, button];
  });

  function draw() {
    const state = lastState;
    const head = lastHead;
    const names = [
      ...new Set([...Object.keys(state.files), ...Object.keys(state.index), ...Object.keys(head)]),
    ].sort();
    if (!names.includes(selected)) selected = names[0] ?? null;

    list.replaceChildren();
    for (const name of names) {
      const item = make('li');
      const button = make('button', name === selected ? 'selected' : '');
      button.type = 'button';
      button.append(
        make('span', 'file-icon', name.endsWith('.html') ? '🌐' : name.endsWith('.css') ? '🎨' : '📄'),
      );
      button.append(make('span', 'file-list-name', name));
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

    for (const [key, button] of versionButtons) button.classList.toggle('selected', key === version);
    const files = VERSIONS.find(item => item.key === version).pick(state, head);
    content.classList.toggle('missing', !selected || !(selected in files));
    if (!selected) content.textContent = '';
    else if (!(selected in files)) content.textContent = `（${selected} 不在這個版本裡）`;
    else content.textContent = files[selected] || '（空檔案）';
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
