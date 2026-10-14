// Commit 圖：把模擬器的 commits / 分支 / HEAD 畫成 SVG。
// 每個 commit 用 id 當 key 保留同一個 <g>，位置改變時用 CSS transition 滑過去，
// 所以 reset、rebase 時看得到 commit「移動」和「變淡」。
// 這張圖不管深淺主題都用亮色底（跟紙上畫圖一樣），顏色才夠清楚。

const SVG_NS = 'http://www.w3.org/2000/svg';
const COLUMN = 100; // 每一代 commit 的水平距離
const RADIUS = 17;
const PAD_X = 46;
const TOP = 26;
const TAG_HEIGHT = 20;

function svg(tag, attributes = {}, text) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

const shorten = (text, length) => (text.length > length ? `${text.slice(0, length - 1)}…` : text);

// 等寬字大約 7.3px 一個字元，中文字算兩個
const textWidth = text => [...text].reduce((sum, char) => sum + (char.charCodeAt(0) > 255 ? 13 : 7.3), 0);

// ---- 版面配置 ----
// x：這個 commit 是第幾代（離最早的 commit 幾步）
// y：main 的歷史固定在最下面那條線，其他分支往上開新的線（標籤在圓圈下方，斜線才不會穿過標籤）
function layout(commits, mainTip) {
  const sorted = Object.values(commits).sort((a, b) => a.order - b.order);
  const mainLine = new Set();
  for (let id = mainTip; id && commits[id]; id = commits[id].parents[0]) mainLine.add(id);

  const generation = {};
  const lane = {};
  const laneTaken = {};
  let lanes = 1;

  for (const commit of sorted) {
    const parentGenerations = commit.parents.filter(id => id in generation).map(id => generation[id]);
    generation[commit.id] = parentGenerations.length ? Math.max(...parentGenerations) + 1 : 0;

    const parent = commit.parents[0];
    if (mainLine.has(commit.id) || (!mainLine.size && !parent)) {
      lane[commit.id] = 0;
    } else if (parent === mainTip && !laneTaken[parent]) {
      lane[commit.id] = 0; // 接在 main 最新 commit 後面，例如 rebase 完的 commit：畫在同一條直線上
    } else if (parent in lane && lane[parent] === 0 && !mainLine.has(parent) && !laneTaken[parent]) {
      lane[commit.id] = 0;
    } else if (parent in lane && !mainLine.has(parent) && !laneTaken[parent]) {
      lane[commit.id] = lane[parent]; // 接在 parent 同一條線上
    } else {
      lane[commit.id] = lanes++; // 從別的線分岔出來，開一條新的線
    }
    if (parent) laneTaken[parent] = true;
  }

  return { sorted, generation, lane, lanes };
}

// ---- 每個 commit 底下要貼哪些標籤 ----
function collectLabels({ branches = {}, currentBranch, detached, remoteBranches = {}, tags = {} }) {
  const labels = {};
  const add = (id, text, kind) => id && (labels[id] ||= []).push({ text, kind });

  for (const [name, id] of Object.entries(branches)) {
    add(id, name, 'branch');
    if (name === currentBranch && !detached) add(id, 'HEAD', 'head');
  }
  if (detached) add(detached, 'HEAD', 'head');
  for (const [name, id] of Object.entries(remoteBranches)) add(id, `origin/${name}`, 'remote');
  for (const [name, id] of Object.entries(tags)) add(id, name, 'tag');
  return labels;
}

export class CommitGraph {
  // options.showMessages：圓圈下方要不要顯示 commit 訊息（練習場的訊息都是 Commit 1、2…，就不顯示）
  constructor(title, { showMessages = true } = {}) {
    this.showMessages = showMessages;
    this.element = make('div', 'graph-panel');
    this.heading = make('h4', '', title);
    this.empty = make('p', 'graph-empty');
    this.svg = svg('svg', { class: 'commit-graph', role: 'img', 'aria-label': title });
    this.svg.append(this.createDefs());
    this.edgeLayer = svg('g', { class: 'edges' });
    this.nodeLayer = svg('g', { class: 'nodes' });
    this.svg.append(this.edgeLayer, this.nodeLayer);
    this.scroller = make('div', 'graph-scroller');
    this.scroller.append(this.svg);
    this.element.append(this.heading, this.empty, this.scroller);

    this.nodes = new Map(); // commit id -> <g>
    this.edges = new Map(); // "child>parent" -> <path>
    this.positions = {};
  }

  // 換題目時清空，避免舊題目的 commit 飛到新位置
  reset() {
    this.edgeLayer.replaceChildren();
    this.nodeLayer.replaceChildren();
    this.nodes.clear();
    this.edges.clear();
    this.positions = {};
  }

  createDefs() {
    const defs = svg('defs');
    for (const [id, className] of [
      ['arrow', 'arrow-head'],
      ['arrow-lost', 'arrow-head lost'],
    ]) {
      const marker = svg('marker', {
        id: `${id}-${(CommitGraph.count = (CommitGraph.count || 0) + 1)}`,
        viewBox: '0 0 10 10',
        refX: 9,
        refY: 5,
        markerWidth: 7,
        markerHeight: 7,
        orient: 'auto',
      });
      marker.append(svg('path', { d: 'M0 0 L10 5 L0 10 z', class: className }));
      defs.append(marker);
      this[id === 'arrow' ? 'arrowId' : 'arrowLostId'] = marker.id;
    }
    return defs;
  }

  // data: { commits, mainTip, headId, reachable, refs, emptyText }
  update({ commits, mainTip, headId, reachable, refs, emptyText }) {
    const { sorted, generation, lane, lanes } = layout(commits, mainTip);
    const labels = collectLabels(refs);
    this.labelTop = RADIUS + (this.showMessages ? 38 : 25);
    const tagsHeight = count => count * (TAG_HEIGHT + 4);

    // 每條線的高度只看「這條線上」最多有幾個標籤，沒標籤的線就矮一點
    const labelsInLane = new Array(lanes).fill(0);
    for (const commit of sorted) {
      const count = labels[commit.id]?.length || 0;
      labelsInLane[lane[commit.id]] = Math.max(labelsInLane[lane[commit.id]], count);
    }
    const laneY = [];
    let y = TOP;
    for (let index = lanes - 1; index >= 0; index--) {
      laneY[index] = y; // 由上往下排：編號大的分支在上，main（0）在最下面
      y += RADIUS + this.labelTop + 14 + tagsHeight(labelsInLane[index]);
    }

    this.empty.textContent = emptyText;
    this.empty.hidden = sorted.length > 0;
    this.scroller.hidden = sorted.length === 0;

    const previous = this.positions;
    const positions = {};
    for (const commit of sorted) {
      positions[commit.id] = {
        x: PAD_X + generation[commit.id] * COLUMN,
        y: laneY[lane[commit.id]],
      };
    }
    this.positions = positions;

    const maxGeneration = Math.max(0, ...Object.values(generation));
    const width = PAD_X * 2 + maxGeneration * COLUMN + 40;
    const height = laneY[0] + this.labelTop + 6 + tagsHeight(labelsInLane[0]);
    this.svg.setAttribute('width', width);
    this.svg.setAttribute('height', height);
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    this.svg.style.maxHeight = `${height}px`; // 可以縮小，但不放大
    // 練習場裡兩張圖（本機、GitHub）依原始高度分配空間，縮放比例才會一樣
    this.element.style.flexGrow = height;

    this.updateEdges(sorted, positions, previous, reachable);
    this.updateNodes(sorted, positions, previous, { headId, reachable, labels });

    // 有新 commit 時，捲到最右邊讓它被看見
    requestAnimationFrame(() => {
      this.scroller.scrollLeft = this.scroller.scrollWidth;
    });
  }

  updateEdges(sorted, positions, previous, reachable) {
    const seen = new Set();
    for (const commit of sorted) {
      for (const parentId of commit.parents) {
        if (!positions[parentId]) continue;
        const key = `${commit.id}>${parentId}`;
        seen.add(key);
        const lost = !reachable.has(commit.id);
        let path = this.edges.get(key);
        if (!path) {
          path = svg('path', { class: 'commit-link entering' });
          this.edgeLayer.append(path);
          this.edges.set(key, path);
          requestAnimationFrame(() => path.classList.remove('entering'));
        }
        path.classList.toggle('lost', lost);
        path.setAttribute('marker-end', `url(#${lost ? this.arrowLostId : this.arrowId})`);
        const d = this.edgePath(positions[commit.id], positions[parentId]);
        path.setAttribute('d', d);
        path.style.d = `path("${d}")`;
      }
    }
    for (const [key, path] of this.edges) {
      if (!seen.has(key)) {
        path.remove();
        this.edges.delete(key);
      }
    }
  }

  // 箭頭從 child 指向 parent（Git 的 commit 記錄的是「我的上一個是誰」）
  edgePath(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;
    const start = [from.x + ux * RADIUS, from.y + uy * RADIUS];
    const end = [to.x - ux * (RADIUS + 3), to.y - uy * (RADIUS + 3)];
    return `M ${start[0].toFixed(1)} ${start[1].toFixed(1)} L ${end[0].toFixed(1)} ${end[1].toFixed(1)}`;
  }

  updateNodes(sorted, positions, previous, { headId, reachable, labels }) {
    const seen = new Set();
    for (const commit of sorted) {
      seen.add(commit.id);
      const { x, y } = positions[commit.id];
      let group = this.nodes.get(commit.id);

      if (!group) {
        group = svg('g', { class: 'commit-node entering' });
        // 新 commit 從 parent 的位置長出來
        const from = previous[commit.parents[0]] || positions[commit.parents[0]] || { x, y };
        group.style.transform = `translate(${from.x}px, ${from.y}px)`;
        this.nodeLayer.append(group);
        this.nodes.set(commit.id, group);
        group.getBoundingClientRect(); // 先套用起點，transition 才會發生
      }
      requestAnimationFrame(() => {
        group.classList.remove('entering');
        group.style.transform = `translate(${x}px, ${y}px)`;
      });

      const kinds = ['commit-node'];
      if (!reachable.has(commit.id)) kinds.push('lost');
      if (commit.id === headId) kinds.push('is-head');
      if (commit.parents.length > 1) kinds.push('is-merge');
      if (group.classList.contains('entering')) kinds.push('entering');
      group.setAttribute('class', kinds.join(' '));

      this.drawNodeContent(group, commit, labels[commit.id] || [], !reachable.has(commit.id));
    }
    for (const [id, group] of this.nodes) {
      if (!seen.has(id)) {
        group.remove();
        this.nodes.delete(id);
      }
    }
  }

  drawNodeContent(group, commit, labels, lost) {
    const title = svg('title', {}, `${commit.id}：${commit.message}${lost ? '（沒有任何分支指著）' : ''}`);
    const circle = svg('circle', { r: RADIUS });
    circle.append(title);
    const hash = svg('text', { y: RADIUS + 15, 'text-anchor': 'middle', class: 'commit-hash' }, commit.id);
    const message = svg(
      'text',
      { y: RADIUS + 28, 'text-anchor': 'middle', class: 'commit-message' },
      shorten(commit.message, 12),
    );
    const tags = svg('g', { class: 'commit-labels' });
    labels.forEach((label, i) => {
      const width = Math.max(textWidth(label.text) + 16, 40);
      const top = this.labelTop + i * (TAG_HEIGHT + 4);
      const tag = svg('g', { class: `ref-tag ${label.kind}` });
      tag.append(
        svg('rect', { x: -width / 2, y: top, width, height: TAG_HEIGHT, rx: 2 }),
        svg('text', { y: top + 14, 'text-anchor': 'middle' }, label.text),
      );
      tags.append(tag);
    });
    group.replaceChildren(circle, hash, ...(this.showMessages ? [message] : []), tags);
  }
}

export function createLegend() {
  const legend = make('div', 'graph-legend');
  const items = [
    ['dot', 'commit'],
    ['dot is-head', 'HEAD 所在的 commit'],
    ['dot is-merge', 'merge commit'],
    ['dot lost', '沒有分支指著的 commit'],
    ['chip branch', '分支'],
    ['chip head', 'HEAD'],
    ['chip remote', '遠端分支'],
    ['chip tag', 'tag'],
  ];
  for (const [className, text] of items) {
    const item = make('span', 'legend-item');
    item.append(make('i', className), document.createTextNode(text));
    legend.append(item);
  }
  return legend;
}
