import { initCopy } from './copy.js';
import { initTabs } from './tabs.js';
import { initGitUI } from './git-ui.js';
import { initPlaygrounds } from './playground.js';
import { initRequestFlow } from './request-flow.js';
import { initBackendQuiz } from './backend-quiz.js';
import { initStageDemo } from './stage-demo.js';
import { initGitLab } from './git-lab.js';
const chapters = [...document.querySelectorAll('.chapter')];
const slides = chapters.map(c => [...c.querySelectorAll(':scope > .slide')]);
let chapter = 0,
  slide = 0,
  overviewOpen = false;
const overview = document.getElementById('overview');
function editable(target) {
  // 在輸入框裡打字時，方向鍵要留給輸入框（例如練習終端機的 ↑ 叫回指令）
  if (!(target instanceof Element)) return false;
  return target.isContentEditable || !!target.closest('input, textarea, select, [role="textbox"]');
}
function bounds(c, s) {
  c = Math.max(0, Math.min(chapters.length - 1, c));
  return [c, Math.max(0, Math.min(slides[c].length - 1, s))];
}
function render() {
  chapters.forEach((element, c) => {
    element.style.transform = `translateX(${(c - chapter) * 100}%)`;
    element.inert = c !== chapter || overviewOpen;
    element.setAttribute('aria-hidden', c !== chapter || overviewOpen);
    slides[c].forEach((element, s) => {
      element.style.transform = `translateY(${(s - slide) * 100}%)`;
      element.inert = c !== chapter || s !== slide || overviewOpen;
      element.setAttribute('aria-hidden', c !== chapter || s !== slide || overviewOpen);
      element.classList.toggle('current', c === chapter && s === slide);
    });
  });
  document.getElementById('chapter-label').textContent = chapters[chapter].dataset.title;
  document.getElementById('position-label').textContent =
    `第 ${chapter + 1} 章・${slide + 1}/${slides[chapter].length}`;
  const total = slides.flat().length;
  const before = slides.slice(0, chapter).reduce((n, list) => n + list.length, 0);
  const percent = ((before + slide + 1) / total) * 100;
  document.getElementById('progress').style.setProperty('--progress', `${percent}%`);
  document.getElementById('progress').setAttribute('aria-valuenow', Math.round(percent));
  document.querySelectorAll('[data-direction]').forEach(b => {
    b.disabled = {
      left: chapter === 0,
      right: chapter === chapters.length - 1,
      up: slide === 0,
      down: slide === slides[chapter].length - 1,
    }[b.dataset.direction];
    b.classList.toggle('more-below', b.dataset.direction === 'down' && !b.disabled);
  });
  overview
    .querySelectorAll('[data-jump]')
    .forEach(b => b.classList.toggle('selected', b.dataset.jump === `${chapter}/${slide}`));
}
function go(c, s) {
  [chapter, slide] = bounds(c, s);
  const hash = `#/${chapter}/${slide}`;
  if (location.hash !== hash) location.hash = hash;
  render();
}
function restore() {
  const match = location.hash.match(/^#\/(\d+)\/(\d+)$/);
  [chapter, slide] = bounds(match ? +match[1] : 0, match ? +match[2] : 0);
  render();
}
function move(direction) {
  if (direction === 'left') go(chapter - 1, 0);
  if (direction === 'right') go(chapter + 1, 0);
  if (direction === 'up') go(chapter, slide - 1);
  if (direction === 'down') go(chapter, slide + 1);
  if (direction === 'next')
    slide < slides[chapter].length - 1
      ? go(chapter, slide + 1)
      : chapter < chapters.length - 1 && go(chapter + 1, 0);
  if (direction === 'previous')
    slide > 0 ? go(chapter, slide - 1) : chapter > 0 && go(chapter - 1, slides[chapter - 1].length - 1);
}
let savedFocus;
function toggleOverview(force) {
  overviewOpen = force ?? !overviewOpen;
  overview.hidden = !overviewOpen;
  document.getElementById('overview-toggle').setAttribute('aria-expanded', overviewOpen);
  if (overviewOpen) {
    savedFocus = document.activeElement;
    render();
    overview.querySelector('.selected')?.focus();
  } else {
    render();
    if (savedFocus && !savedFocus.closest('[inert]')) savedFocus.focus();
    else document.getElementById('overview-toggle').focus();
  }
}
chapters.forEach((c, ci) => {
  const column = document.createElement('div');
  column.className = 'overview-column';
  const title = document.createElement('h2');
  title.textContent = `${ci + 1}. ${c.dataset.title}`;
  column.append(title);
  slides[ci].forEach((s, si) => {
    const button = document.createElement('button');
    button.dataset.jump = `${ci}/${si}`;
    const label = s.dataset.title || s.querySelector('h1,h2,h3')?.textContent || '投影片';
    button.textContent = `${si + 1} · ${label}`;
    button.addEventListener('click', () => {
      go(ci, si);
      toggleOverview(false);
    });
    column.append(button);
  });
  overview.append(column);
});
document.addEventListener('keydown', e => {
  if (editable(e.target)) return;
  if (e.key === 'Escape' || e.key.toLowerCase() === 'o') {
    e.preventDefault();
    toggleOverview();
    return;
  }
  if (overviewOpen || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.target.closest('button,a') && e.key === ' ') return;
  const directions = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowUp: 'up',
    ArrowDown: 'down',
    ' ': 'next',
    PageDown: 'next',
    PageUp: 'previous',
  };
  if (directions[e.key]) {
    e.preventDefault();
    move(directions[e.key]);
  }
  if (e.key === 'Home') {
    e.preventDefault();
    go(0, 0);
  }
  if (e.key === 'End') {
    e.preventDefault();
    go(chapters.length - 1, slides.at(-1).length - 1);
  }
});
document
  .querySelectorAll('[data-direction]')
  .forEach(b => b.addEventListener('click', () => move(b.dataset.direction)));
document.getElementById('overview-toggle').addEventListener('click', () => toggleOverview());
let touch;
document.getElementById('deck').addEventListener(
  'touchstart',
  e => {
    touch = null;
    if (editable(e.target) || e.target.closest('.git-sandbox, .playground, pre, button, a')) return;
    const p = e.touches[0];
    touch = { x: p.clientX, y: p.clientY, scroll: slides[chapter][slide].scrollTop };
  },
  { passive: true },
);
document.getElementById('deck').addEventListener(
  'touchend',
  e => {
    if (!touch) return;
    const p = e.changedTouches[0];
    const dx = p.clientX - touch.x,
      dy = p.clientY - touch.y;
    const scrolled = slides[chapter][slide].scrollTop !== touch.scroll;
    touch = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 65) return;
    if (Math.abs(dx) > Math.abs(dy) * 1.25) move(dx > 0 ? 'left' : 'right');
    else if (!scrolled && Math.abs(dy) > Math.abs(dx) * 1.25) move(dy > 0 ? 'up' : 'down');
  },
  { passive: true },
);
const theme = document.getElementById('theme-toggle');
const media = matchMedia('(prefers-color-scheme: dark)');
let preference;
try {
  preference = localStorage.getItem('web-teaching-theme');
} catch {
  /* private browser */
}
function setTheme(value) {
  document.documentElement.dataset.theme = value;
  theme.textContent = value === 'dark' ? '☀ 淺色' : '☾ 深色';
  theme.setAttribute('aria-label', `切換為${value === 'dark' ? '淺色' : '深色'}模式`);
}
setTheme(preference || (media.matches ? 'dark' : 'light'));
media.addEventListener('change', e => {
  if (!preference) setTheme(e.matches ? 'dark' : 'light');
});
theme.addEventListener('click', () => {
  preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(preference);
  try {
    localStorage.setItem('web-teaching-theme', preference);
  } catch {}
});
window.addEventListener('hashchange', restore);
initTabs();
initGitUI();
initPlaygrounds();
initRequestFlow();
initGitLab();
initBackendQuiz();
initStageDemo();
initCopy();
restore();
if (!location.hash) history.replaceState(null, '', '#/0/0');
