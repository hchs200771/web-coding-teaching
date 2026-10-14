export function initPlaygrounds() {
  document.querySelectorAll('.playground').forEach(root => {
    const editors = Object.fromEntries(
      [...root.querySelectorAll('textarea[data-lang]')].map(e => [e.dataset.lang, e]),
    );
    const frame = root.querySelector('iframe');
    let timer;
    function update() {
      const script = editors.js.value.replace(/<\/script/gi, '<\\/script');
      frame.srcdoc = `<!doctype html><html lang="zh-TW"><meta charset="utf-8"><style>${editors.css.value}</style><body>${editors.html.value}<script>${script}<\/script></body></html>`;
    }
    Object.values(editors).forEach(e =>
      e.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(update, 180);
      }),
    );
    update();
  });
}
