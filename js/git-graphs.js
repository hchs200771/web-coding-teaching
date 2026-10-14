// 本地 + 遠端 commit 圖 + 圖例，任務練習（git-ui.js）和 Git 練習場（git-lab.js）共用。
// 圖例只列出目前畫面上真的有出現的東西。

import { CommitGraph, createLegend } from './commit-graph.js';

// 把模擬器 state 轉成 commit 圖需要的資料
export function localGraphData(sim) {
  const { state } = sim;
  return {
    commits: state.commits,
    mainTip: state.branches.main ?? state.branches[state.branch],
    headId: state.detached ?? state.branches[state.branch],
    reachable: sim.reachableCommits(),
    refs: {
      branches: state.branches,
      currentBranch: state.branch,
      detached: state.detached,
      remoteBranches: state.remoteTracking,
      tags: state.tags,
    },
    emptyText: state.initialized ? '還沒有 commit' : '還不是 Git 儲存庫（試試 git init）',
  };
}

export function remoteGraphData(sim) {
  const { remote } = sim.state;
  return {
    commits: remote.commits,
    mainTip: remote.branches.main,
    headId: null,
    reachable: new Set(Object.keys(remote.commits)),
    refs: { branches: remote.branches },
    emptyText: '遠端是空的，還沒 push 過',
  };
}

export function createGitGraphs({ localTitle, remoteTitle, showMessages = true }) {
  const local = new CommitGraph(localTitle, { showMessages });
  const remote = new CommitGraph(remoteTitle, { showMessages });
  const legend = createLegend();

  return {
    local: local.element,
    remote: remote.element,
    legend: legend.element,
    // 回傳有沒有遠端，讓呼叫的地方調整版面
    render(sim) {
      local.update(localGraphData(sim));
      const hasRemote = !!sim.state.remote;
      remote.element.hidden = !hasRemote;
      if (hasRemote) remote.update(remoteGraphData(sim));
      legend.update(local.features, hasRemote ? remote.features : new Set());
      return hasRemote;
    },
    reset() {
      local.reset();
      remote.reset();
    },
  };
}
