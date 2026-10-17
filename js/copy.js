// 幫每個 <pre class="cmd"> 加上「複製」按鈕。

const CLIPBOARD_TIMEOUT = 800;

// 舊方法：放一個看不到的 textarea，選取後執行 copy。用在 http:// 或剪貼簿 API 沒回應時。
function legacyCopy(text) {
  const previousFocus = document.activeElement;
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;left:-9999px;top:0';
  document.body.append(area);
  area.select();
  area.setSelectionRange(0, text.length);

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } finally {
    area.remove();
    previousFocus?.focus();
  }
  if (!copied) throw new Error('copy unavailable');
}

export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    // 某些環境裡 writeText 會一直不回應，所以加上逾時
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), CLIPBOARD_TIMEOUT),
    );
    try {
      await Promise.race([navigator.clipboard.writeText(text), timeout]);
      return;
    } catch {
      // 改用舊方法
    }
  }
  legacyCopy(text);
}

// 兩個疊在一起的方框：大家熟悉的「複製」圖示
const COPY_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/>' +
  '<path d="M15 9V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4"/></svg>';

export function initCopy(root = document) {
  root.querySelectorAll('pre.cmd').forEach(pre => {
    if (pre.querySelector('.copy-button')) return;

    const button = document.createElement('button');
    button.className = 'copy-button';
    button.type = 'button';
    button.innerHTML = `${COPY_ICON}<span>複製</span>`;
    button.setAttribute('aria-label', '複製指令');
    const label = button.querySelector('span');

    button.addEventListener('click', async () => {
      try {
        await copyText(pre.querySelector('code').textContent);
        label.textContent = '已複製';
        button.classList.add('copied');
      } catch {
        label.textContent = '請手動選取';
      }
      clearTimeout(button.resetTimer);
      button.resetTimer = setTimeout(() => {
        label.textContent = '複製';
        button.classList.remove('copied');
      }, 1500);
    });

    pre.append(button);
  });
}
