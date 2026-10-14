export function initTabs() {
  document.querySelectorAll('.tabs').forEach(group => {
    const buttons = [...group.querySelectorAll('[data-tab]')];
    group.querySelector('.tab-buttons')?.setAttribute('role', 'tablist');
    function select(button) {
      buttons.forEach(b => {
        const active = b === button;
        b.setAttribute('aria-selected', active);
        b.tabIndex = active ? 0 : -1;
        const panel = document.getElementById(b.dataset.tab);
        if (panel) panel.hidden = !active;
      });
    }
    buttons.forEach((button, index) => {
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', button.dataset.tab);
      document.getElementById(button.dataset.tab)?.setAttribute('role', 'tabpanel');
      button.addEventListener('click', () => select(button));
      button.addEventListener('keydown', e => {
        if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
        e.stopPropagation();
        e.preventDefault();
        const next = buttons[(index + (e.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length];
        select(next);
        next.focus();
      });
    });
    if (buttons.length) select(buttons[0]);
  });
}
