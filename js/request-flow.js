// 「網站怎麼運作」互動圖：一個請求從瀏覽器出發，經過 DNS、伺服器、資料庫，再回到瀏覽器。

import { make } from './dom.js';

const NODES = [
  { id: 'browser', icon: '🖥️', name: '瀏覽器', role: '前端' },
  { id: 'dns', icon: '📒', name: 'DNS', role: '網路電話簿' },
  { id: 'server', icon: '⚙️', name: '伺服器', role: '後端' },
  { id: 'db', icon: '🗄️', name: '資料庫', role: '存資料' },
];

// 每一步：封包從哪個節點移到哪個節點、說明文字、範例資料
const STEPS = [
  {
    from: 'browser',
    to: 'browser',
    title: '1. 你在瀏覽器輸入網址',
    text: '瀏覽器只看得懂 IP 位址，所以要先問：這個網域在哪裡？',
    sample: 'https://my-site.com',
  },
  {
    from: 'browser',
    to: 'dns',
    title: '2. 問 DNS：my-site.com 在哪？',
    text: 'DNS 像電話簿，把好記的網域換成伺服器的 IP 位址。',
    sample: 'my-site.com  →  185.199.108.153',
  },
  {
    from: 'dns',
    to: 'server',
    title: '3. 拿著 IP 送出 HTTP 請求',
    text: '瀏覽器連到伺服器，說「我要首頁」或「我要文章資料」。',
    sample: 'GET /api/posts HTTP/1.1\nHost: my-site.com',
  },
  {
    from: 'server',
    to: 'db',
    title: '4. 後端去資料庫拿資料',
    text: '後端程式依照請求，向資料庫查詢需要的資料。',
    sample: 'SELECT title, likes FROM posts\nORDER BY created_at DESC\nLIMIT 10;',
  },
  {
    from: 'db',
    to: 'server',
    title: '5. 資料庫回傳資料，後端整理成 JSON',
    text: '後端把資料整理好，準備回給瀏覽器。',
    sample: '[\n  { "title": "我的第一篇", "likes": 12 },\n  { "title": "學 Git 心得", "likes": 30 }\n]',
  },
  {
    from: 'server',
    to: 'browser',
    title: '6. 回應送回瀏覽器，畫出畫面',
    text: '瀏覽器用 HTML 排結構、CSS 上樣式、JavaScript 把 JSON 變成文章列表。',
    sample: 'HTTP/1.1 200 OK\nContent-Type: application/json',
  },
];

const STEP_DELAY = 1800;

function createFlow(root) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let current = 0;
  let timer;

  // ---- 節點與連線 ----
  const track = make('div', 'flow-track');
  const nodeElements = {};
  NODES.forEach((node, index) => {
    if (index > 0) track.append(make('div', 'flow-link'));
    const element = make('div', 'flow-node');
    element.dataset.node = node.id;
    element.append(
      make('span', 'flow-icon', node.icon),
      make('strong', '', node.name),
      make('small', '', node.role),
    );
    nodeElements[node.id] = element;
    track.append(element);
  });
  const packet = make('div', 'flow-packet');
  packet.setAttribute('aria-hidden', 'true');
  track.append(packet);

  // ---- 說明面板 ----
  const detail = make('div', 'flow-detail');
  const title = make('h3');
  const text = make('p');
  const sample = make('pre', 'flow-sample');
  detail.append(title, text, sample);
  detail.setAttribute('aria-live', 'polite');

  // ---- 控制按鈕 ----
  const controls = make('div', 'flow-controls');
  const previousButton = make('button', '', '← 上一步');
  const playButton = make('button', 'primary', '▶ 播放整段');
  const nextButton = make('button', '', '下一步 →');
  const counter = make('span', 'flow-counter');
  for (const button of [previousButton, playButton, nextButton]) button.type = 'button';
  controls.append(previousButton, playButton, nextButton, counter);

  root.replaceChildren(track, controls, detail);

  // 把封包移到某個節點的中心（相對於 track）
  function placePacket(nodeId, animate) {
    const node = nodeElements[nodeId];
    const x = node.offsetLeft + node.offsetWidth / 2;
    const y = node.offsetTop; // 沿著節點上緣移動，不會蓋住文字
    packet.style.transition = animate && !reducedMotion ? '' : 'none';
    packet.style.transform = `translate(${x}px, ${y}px)`;
  }

  function show(index, animate = true) {
    current = index;
    const step = STEPS[index];
    for (const [id, element] of Object.entries(nodeElements)) {
      element.classList.toggle('active', id === step.to);
      element.classList.toggle('source', id === step.from && step.from !== step.to);
    }
    // 先放在出發點，下一個 frame 再滑到目的地
    placePacket(step.from, false);
    requestAnimationFrame(() => requestAnimationFrame(() => placePacket(step.to, animate)));

    title.textContent = step.title;
    text.textContent = step.text;
    sample.textContent = step.sample;
    counter.textContent = `${index + 1} / ${STEPS.length}`;
    previousButton.disabled = index === 0;
    nextButton.disabled = index === STEPS.length - 1;
  }

  function stop() {
    clearInterval(timer);
    timer = undefined;
    playButton.textContent = '▶ 播放整段';
  }

  playButton.addEventListener('click', () => {
    if (timer) return stop();
    show(0);
    playButton.textContent = '■ 停止';
    timer = setInterval(() => {
      if (current >= STEPS.length - 1) return stop();
      show(current + 1);
    }, STEP_DELAY);
  });
  previousButton.addEventListener('click', () => {
    stop();
    show(Math.max(0, current - 1));
  });
  nextButton.addEventListener('click', () => {
    stop();
    show(Math.min(STEPS.length - 1, current + 1));
  });
  // 點節點也可以跳到「抵達這個節點」的第一步
  for (const [id, element] of Object.entries(nodeElements)) {
    element.addEventListener('click', () => {
      stop();
      show(
        Math.max(
          0,
          STEPS.findIndex(step => step.to === id),
        ),
      );
    });
  }

  // 版面改變（換頁、轉手機方向）時重新對齊封包
  new ResizeObserver(() => placePacket(STEPS[current].to, false)).observe(track);
  show(0, false);
}

export function initRequestFlow() {
  document.querySelectorAll('.request-flow').forEach(createFlow);
}
