// 模擬終端機：輸出區 + 輸入列，支援 ↑ ↓ 叫回之前的指令。
// 任務練習（git-ui.js）和 Git 練習場（git-lab.js）共用。

function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

let count = 0;

export function createTerminal({ title, placeholder = '輸入指令，例如 git status', onCommand }) {
  const element = make('div', 'terminal');
  const header = make('div', 'terminal-title');
  header.append(make('span', '', title));
  const badge = make('span', 'terminal-badge');
  header.append(badge);

  const history = make('div', 'terminal-history');
  history.setAttribute('role', 'log');
  history.setAttribute('aria-label', '指令輸出');

  const form = make('form', 'terminal-form');
  const input = make('input');
  input.id = `terminal-input-${++count}`;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.placeholder = placeholder;
  input.setAttribute('aria-label', '輸入模擬指令');
  input.setAttribute('autocapitalize', 'off');
  const sendButton = make('button', '', '執行');
  sendButton.type = 'submit';
  form.append(make('span', 'terminal-prompt', '$'), input, sendButton);
  element.append(header, history, form);

  let recall = [];
  let recallIndex = 0;
  let draft = '';

  function print(text, kind = 'output') {
    history.append(make('pre', `terminal-${kind}`, text));
    while (history.children.length > 150) history.firstChild.remove();
    history.scrollTop = history.scrollHeight;
  }

  function submit(command) {
    print(`$ ${command}`, 'command');
    recall.push(command);
    recallIndex = recall.length;
    onCommand(command);
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    const command = input.value.trim();
    if (!command) return;
    input.value = '';
    draft = '';
    submit(command);
    // preventScroll：不讓瀏覽器為了對焦去捲動投影片
    input.focus({ preventScroll: true });
  });

  input.addEventListener('keydown', event => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    event.stopPropagation();
    if (recallIndex === recall.length) draft = input.value;
    const delta = event.key === 'ArrowUp' ? -1 : 1;
    recallIndex = Math.max(0, Math.min(recall.length, recallIndex + delta));
    input.value = recallIndex === recall.length ? draft : recall[recallIndex];
  });

  return {
    element,
    print,
    // 把指令填進輸入列（給「試試看」按鈕用），不直接執行，讓學習者自己按 Enter
    fill(command) {
      input.value = command;
      input.focus({ preventScroll: true });
    },
    clear() {
      history.replaceChildren();
      recall = [];
      recallIndex = 0;
    },
    setBadge(text) {
      badge.textContent = text;
    },
  };
}
