// 用紋繡網站的例子，練習判斷什麼時候需要後端。

import { make } from './dom.js';

const FEATURES = [
  {
    title: '作品集照片牆（飄眉、霧眉前後對比）',
    answer: '不用後端',
    reason: '照片是放在網站裡的靜態檔案，瀏覽器可以直接顯示。',
    needsBackend: false,
  },
  {
    title: '價目表、服務介紹',
    answer: '不用後端',
    reason: '內容先寫在網站裡就能顯示，不需要另外記住客人資料。',
    needsBackend: false,
  },
  {
    title: '聯絡方式、地圖、LINE / IG 連結',
    answer: '不用後端',
    reason: '這些是文字、地圖或連結，交給現成服務就可以。',
    needsBackend: false,
  },
  {
    title: '預約按鈕連到 LINE 官方帳號或 Google 表單',
    answer: '不用自己寫後端',
    reason: '預約資料由 LINE 或 Google 表單代為處理。',
    needsBackend: false,
  },
  {
    title: '網站上直接選時段，自動擋掉已被約走的時間',
    answer: '需要後端',
    reason: '網站要記住每個時段被誰預約，才能擋掉重複預約。',
    needsBackend: true,
  },
  {
    title: '客人登入看自己的預約紀錄',
    answer: '需要後端',
    reason: '網站要辨認帳號，並從資料庫找出這位客人的紀錄。',
    needsBackend: true,
  },
  {
    title: '客人留下評論，你在後台審核',
    answer: '需要後端',
    reason: '評論要先被保存，才能讓你登入後台查看和審核。',
    needsBackend: true,
  },
];

function createQuiz(root) {
  const intro = make('p', 'backend-quiz__intro', '點一個功能，看看它需要什麼。');
  const chips = make('div', 'backend-quiz__chips');
  const results = make('div', 'backend-quiz__results');
  results.setAttribute('aria-live', 'polite');
  const controls = make('div', 'backend-quiz__controls');
  const showAllButton = make('button', 'backend-quiz__show-all', '全部顯示');
  const resetButton = make('button', 'backend-quiz__reset', '重來');
  showAllButton.type = resetButton.type = 'button';
  controls.append(showAllButton, resetButton);

  const buttons = [];
  const resultRows = [];
  FEATURES.forEach((feature, index) => {
    const button = make('button', 'backend-quiz__chip', feature.title);
    button.type = 'button';
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-controls', `backend-quiz-result-${index}`);
    const result = make('p', 'backend-quiz__result');
    result.id = `backend-quiz-result-${index}`;
    result.hidden = true;
    result.append(make('span', '', `${feature.title}：`));
    result.append(make('strong', feature.needsBackend ? 'needs-backend' : 'no-backend', feature.answer));
    result.append(document.createTextNode(`：${feature.reason}`));
    button.addEventListener('click', () => reveal(index));
    buttons.push(button);
    resultRows.push(result);
    chips.append(button);
  });

  function reveal(index) {
    const feature = FEATURES[index];
    buttons[index].setAttribute('aria-pressed', 'true');
    buttons[index].classList.add(feature.needsBackend ? 'needs-backend' : 'no-backend');
    resultRows[index].hidden = false;
    results.append(resultRows[index]);
  }

  showAllButton.addEventListener('click', () => {
    FEATURES.forEach((_, index) => reveal(index));
    intro.textContent = '全部功能都看過了。';
  });
  resetButton.addEventListener('click', () => {
    buttons.forEach(button => {
      button.setAttribute('aria-pressed', 'false');
      button.classList.remove('needs-backend', 'no-backend');
    });
    resultRows.forEach(row => { row.hidden = true; });
    results.replaceChildren();
    intro.textContent = '點一個功能，看看它需要什麼。';
  });

  root.replaceChildren(intro, chips, controls, results);
}

export function initBackendQuiz() {
  document.querySelectorAll('.backend-quiz').forEach(createQuiz);
}
