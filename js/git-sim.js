// A deterministic, entirely local teaching model. No command reaches a real shell.
export const SCENARIOS = [
  { id: 'empty', name: '空白資料夾', description: '從 git init 開始建立版本紀錄。' },
  { id: 'fresh-files', name: '第一次提交', description: '已有網頁檔案，從初始化開始練習暫存與提交。' },
  { id: 'has-history', name: '已有提交紀錄', description: '探索差異、還原與重設。' },
  { id: 'remote-ready', name: '遠端協作', description: '本機已連接 origin，練習推送與同步。' },
  { id: 'branching', name: '分支練習', description: '建立分支並合併變更。' },
  { id: 'gh-flow', name: 'GitHub 工作流程', description: '使用 gh 建立 Pull Request 與 Issue。' },
];

export function tokenize(input) {
  const tokens = [];
  let word = '',
    quote = null,
    started = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '\\' && quote !== "'") {
      if (i + 1 === input.length) throw new Error('行尾的跳脫字元後需要內容。');
      word += input[++i];
      started = true;
    } else if (quote) {
      if (char === quote) quote = null;
      else word += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      started = true;
    } else if (/\s/.test(char)) {
      if (started) tokens.push(word);
      word = '';
      started = false;
    } else if (char === '>') {
      if (started) tokens.push(word);
      word = '';
      started = false;
      if (input[i + 1] === '>') {
        tokens.push('>>');
        i++;
      } else tokens.push('>');
    } else {
      word += char;
      started = true;
    }
  }
  if (quote) throw new Error('引號尚未關閉。');
  if (started) tokens.push(word);
  return tokens;
}

const copy = value => JSON.parse(JSON.stringify(value));
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const changes = (from, to) =>
  [...new Set([...Object.keys(from), ...Object.keys(to)])].filter(path => from[path] !== to[path]).sort();
const same = (a, b) => changes(a, b).length === 0;

export function createSimulator(scenario = 'empty') {
  if (typeof scenario === 'object') scenario = scenario.id;
  if (!SCENARIOS.some(item => item.id === scenario)) scenario = 'empty';
  let sequence = 0;
  const state = {
    scenario,
    initialized: !['empty', 'fresh-files'].includes(scenario),
    files: {},
    index: {},
    commits: {},
    branches: { main: null },
    branch: 'main',
    remote: null,
    remoteTracking: {},
    loggedIn: scenario === 'gh-flow',
    prs: [],
    issues: [],
    events: new Set(),
    cwd: '/workspace/my-project',
  };
  const headId = () => state.branches[state.branch];
  const headFiles = () => state.commits[headId()]?.files || {};
  const event = name => state.events.add(name);
  const newCommit = (message, files, parents = []) => {
    const id = ((++sequence * 0x9e3779b1) >>> 0).toString(16).padStart(8, '0').slice(0, 7);
    // order 記錄建立順序，畫 commit graph 時用來由左到右排列
    const commit = { id, order: sequence, message, parents: parents.filter(Boolean), files: copy(files) };
    state.commits[id] = commit;
    return id;
  };
  const seed = (message, files) => {
    state.branches.main = newCommit(message, files, [state.branches.main]);
    state.files = copy(files);
    state.index = copy(files);
  };
  if (scenario !== 'empty')
    state.files = {
      'README.md': '# 我的專案\n',
      'index.html': '<h1>Hello Git</h1>\n',
      'style.css': 'body { color: #243047; }\n',
    };
  if (!['empty', 'fresh-files'].includes(scenario)) {
    seed('Initial commit', state.files);
    if (scenario === 'has-history') {
      seed('Update home page', {
        ...state.files,
        'index.html': '<h1>Hello Git</h1>\n<p>一起學習 Git。</p>\n',
      });
      seed('Add page styling', {
        ...state.files,
        'style.css': 'body { color: #243047; background: #f7f8fa; }\n',
      });
    }
  }
  if (['remote-ready', 'gh-flow'].includes(scenario)) {
    state.remote = {
      url: 'https://github.com/learner/my-project.git',
      branches: copy(state.branches),
      commits: copy(state.commits),
    };
    state.remoteTracking = copy(state.remote.branches);
  }
  function pathOf(path) {
    const normalized = path.replace(/^\.\//, '');
    if (
      !normalized ||
      normalized.startsWith('/') ||
      normalized.split('/').some(part => ['..', '__proto__', 'constructor', 'prototype'].includes(part)) ||
      normalized === '.git' ||
      normalized.startsWith('.git/')
    )
      throw new Error('請使用專案內的檔案路徑。');
    return normalized;
  }
  function resolve(ref = 'HEAD') {
    const match = /^(.*?)(?:~(\d+))?$/.exec(ref);
    const name = match[1];
    const matches = Object.keys(state.commits).filter(key => key.startsWith(name));
    const named = name === 'HEAD' || own(state.branches, name) || name.startsWith('origin/');
    if (!named && matches.length > 1) throw new Error(`版本縮寫不唯一：${name}。請輸入更多 hash 字元。`);
    let id =
      name === 'HEAD'
        ? headId()
        : own(state.branches, name)
          ? state.branches[name]
          : name.startsWith('origin/')
            ? state.remoteTracking[name.slice(7)]
            : matches[0];
    for (let i = 0; i < Number(match[2] || 0); i++) id = state.commits[id]?.parents[0];
    if (!id || !state.commits[id]) throw new Error(`找不到版本：${ref}`);
    return id;
  }
  function ancestors(id) {
    const result = new Set(),
      pending = [id];
    while (pending.length) {
      const current = pending.pop();
      if (!current || result.has(current)) continue;
      result.add(current);
      pending.push(...(state.commits[current]?.parents || []));
    }
    return result;
  }
  const clean = () => same(state.files, state.index) && same(state.index, headFiles());
  function loadHead() {
    state.files = copy(headFiles());
    state.index = copy(headFiles());
  }
  function syncRemote() {
    if (!state.remote) throw new Error('尚未設定 origin。請先執行 git remote add origin <url>。');
    Object.assign(state.commits, copy(state.remote.commits));
    state.remoteTracking = copy(state.remote.branches);
  }
  function mergeCommit(target, message, forceMerge = false) {
    if (!clean()) throw new Error('請先提交或還原工作目錄的變更，再合併。');
    const current = headId();
    if (current === target || ancestors(current).has(target)) return 'Already up to date.';
    if (!current || (ancestors(target).has(current) && !forceMerge)) {
      state.branches[state.branch] = target;
      loadHead();
      event('merge');
      return `Fast-forward\n${current || '(root)'}..${target}`;
    }
    const theirs = state.commits[target].files,
      ours = headFiles();
    const theirAncestors = ancestors(target);
    const baseId = [...ancestors(current)].find(id => theirAncestors.has(id));
    const base = state.commits[baseId]?.files || {},
      merged = copy(ours);
    const conflicts = [];
    for (const path of changes(base, theirs)) {
      if (ours[path] !== base[path] && ours[path] !== theirs[path]) conflicts.push(path);
      if (own(theirs, path)) merged[path] = theirs[path];
      else delete merged[path];
    }
    state.branches[state.branch] = newCommit(message, merged, [current, target]);
    loadHead();
    event('merge');
    return `Merge made by the three-way strategy.${conflicts.length ? `\n教學簡化：${conflicts.join(', ')} 同時被修改，已採用合入分支版本。真實 Git 可能需要手動解決衝突。` : ''}`;
  }
  const flagValue = (args, ...flags) => {
    const index = args.findIndex(arg => flags.includes(arg));
    return index >= 0 ? args[index + 1] : undefined;
  };
  function git(args) {
    const command = args.shift();
    if (command === 'init') {
      const existed = state.initialized;
      state.initialized = true;
      event('init');
      return `${existed ? 'Reinitialized existing' : 'Initialized empty'} Git repository in ${state.cwd}/.git/`;
    }
    if (command === 'clone') {
      const url = args[0];
      if (!url) throw new Error('用法：git clone <url> [directory]');
      if (state.initialized || Object.keys(state.files).length)
        throw new Error('請切換至空白情境後再練習 clone。');
      state.initialized = true;
      seed('Initial commit', { 'README.md': '# Cloned project\n' });
      state.remote = { url, branches: copy(state.branches), commits: copy(state.commits) };
      state.remoteTracking = copy(state.branches);
      state.cwd = `/workspace/${
        args[1] ||
        url
          .split('/')
          .pop()
          .replace(/\.git$/, '') ||
        'my-project'
      }`;
      event('clone');
      return `Cloning into '${state.cwd.split('/').pop()}'...\n完成：已載入教學用遠端快照。`;
    }
    if (!state.initialized) throw new Error('fatal: not a git repository。請先執行 git init。');
    if (command === 'status') {
      event('status');
      const head = headFiles();
      const staged = changes(head, state.index);
      const unstaged = changes(state.index, state.files).filter(path => own(state.index, path));
      const untracked = Object.keys(state.files).filter(path => !own(state.index, path));
      const label = (path, from, to) =>
        !own(to, path) ? 'deleted' : !own(from, path) ? 'new file' : 'modified';

      if (args.includes('--short') || args.includes('-s')) {
        const shortCode = (path, from, to) => (!own(to, path) ? 'D' : !own(from, path) ? 'A' : 'M');
        return [...new Set([...staged, ...unstaged, ...untracked])]
          .sort()
          .map(path => {
            if (untracked.includes(path) && !staged.includes(path)) return `?? ${path}`;
            const x = staged.includes(path) ? shortCode(path, head, state.index) : ' ';
            const y = unstaged.includes(path) ? shortCode(path, state.index, state.files) : ' ';
            return `${x}${y} ${path}`;
          })
          .join('\n');
      }

      const list = (paths, from, to) => paths.map(path => `  ${label(path, from, to)}: ${path}`).join('\n');
      const sections = [`On branch ${state.branch}`];
      if (!headId()) sections.push('No commits yet');
      if (staged.length) sections.push(`Changes to be committed:\n${list(staged, head, state.index)}`);
      if (unstaged.length)
        sections.push(`Changes not staged for commit:\n${list(unstaged, state.index, state.files)}`);
      if (untracked.length)
        sections.push(`Untracked files:\n${untracked.map(path => `  ${path}`).join('\n')}`);
      if (!staged.length && !unstaged.length && !untracked.length)
        sections.push('nothing to commit, working tree clean');
      return sections.join('\n\n');
    }
    if (command === 'add') {
      if (!args.length) throw new Error('用法：git add <file> 或 git add .');
      const all = args.some(arg => ['.', '-A', '--all'].includes(arg));
      const paths = all
        ? [...new Set([...Object.keys(state.files), ...Object.keys(state.index)])]
        : args.filter(arg => arg !== '--').map(pathOf);
      for (const path of paths)
        if (!own(state.files, path) && !own(state.index, path))
          throw new Error(`pathspec '${path}' did not match any files`);
      for (const path of paths) {
        if (own(state.files, path)) state.index[path] = state.files[path];
        else delete state.index[path];
      }
      event('add');
      return '已更新暫存區。';
    }
    if (command === 'commit') {
      const message = flagValue(args, '-m', '--message', '-am', '-ma');
      if (!message?.trim()) throw new Error('請提供提交訊息：git commit -m "message"');
      if (args.some(arg => ['-a', '--all', '-am', '-ma'].includes(arg)))
        for (const path of Object.keys(headFiles())) {
          if (own(state.files, path)) state.index[path] = state.files[path];
          else delete state.index[path];
        }
      if (same(headFiles(), state.index)) throw new Error('nothing to commit。請先修改檔案並 git add。');
      const id = newCommit(message, state.index, [headId()]);
      state.branches[state.branch] = id;
      event('commit');
      if (state.branch !== 'main') event('commit-on-feature');
      return `[${state.branch} ${id}] ${message}`;
    }
    if (command === 'log') {
      event('log');
      if (!headId()) return '尚無提交紀錄。';
      const commits = [...ancestors(headId())].map(id => state.commits[id]);
      const limitFlag =
        flagValue(args, '-n', '--max-count') || args.find(arg => /^-\d+$/.test(arg))?.slice(1);
      const limit = Number(limitFlag || commits.length);
      const graph = args.includes('--graph');
      const oneline = args.includes('--oneline');
      return commits
        .slice(0, limit)
        .map(commit => {
          const bullet = graph ? (commit.parents.length > 1 ? '*   ' : '* ') : '';
          if (oneline) return `${bullet}${commit.id} ${commit.message}`;
          const decoration = commit.id === headId() ? ` (HEAD -> ${state.branch})` : '';
          return `${bullet}commit ${commit.id}${decoration}\n\n    ${commit.message}`;
        })
        .join('\n');
    }
    if (command === 'diff') {
      event('diff');
      const cached = args.includes('--staged') || args.includes('--cached');
      let from = cached ? headFiles() : state.index;
      const to = cached ? state.index : state.files;
      const ref = args.find(arg => arg === 'HEAD' || /^HEAD~\d+$/.test(arg));
      if (ref) from = state.commits[resolve(ref)].files;
      const paths = changes(from, to).filter(path => cached || ref || own(state.index, path));
      const lines = (text, sign) =>
        (text || '')
          .split('\n')
          .filter(Boolean)
          .map(line => sign + line)
          .join('\n');
      const output = paths.map(path =>
        [
          `diff --git a/${path} b/${path}`,
          `--- ${own(from, path) ? `a/${path}` : '/dev/null'}`,
          `+++ ${own(to, path) ? `b/${path}` : '/dev/null'}`,
          lines(from[path], '-'),
          lines(to[path], '+'),
        ].join('\n'),
      );
      return output.join('\n') || '沒有差異。';
    }
    if (command === 'branch') {
      if (!args.length || args[0] === '-a')
        return [
          ...Object.keys(state.branches).map(name => `${name === state.branch ? '*' : ' '} ${name}`),
          ...(args[0] === '-a'
            ? Object.keys(state.remoteTracking).map(name => `  remotes/origin/${name}`)
            : []),
        ].join('\n');
      if (['-d', '-D'].includes(args[0])) {
        const name = args[1];
        if (!own(state.branches, name) || name === state.branch)
          throw new Error('分支不存在，或正在使用該分支。');
        if (args[0] === '-d' && !ancestors(headId()).has(state.branches[name]))
          throw new Error('分支尚未合併。');
        delete state.branches[name];
        return `Deleted branch ${name}.`;
      }
      if (args[0] === '-M' || args[0] === '-m') {
        const name = args[1];
        if (!name || own(state.branches, name) || ['__proto__', 'constructor', 'prototype'].includes(name))
          throw new Error('請指定尚未存在的新分支名稱。');
        state.branches[name] = headId();
        delete state.branches[state.branch];
        state.branch = name;
        return `分支已更名為 ${name}。`;
      }
      const name = args[0];
      if (
        own(state.branches, name) ||
        name.startsWith('-') ||
        ['__proto__', 'constructor', 'prototype'].includes(name)
      )
        throw new Error('分支名稱無效或已存在。');
      state.branches[name] = args[1] ? resolve(args[1]) : headId();
      event('branch-create');
      return `Created branch ${name}.`;
    }
    if (command === 'switch' || command === 'checkout') {
      if (args[0] === '--') return git(['restore', ...args.slice(1)]);
      const create = ['-c', '-b'].includes(args[0]),
        name = args[create ? 1 : 0];
      if (!name) throw new Error(`用法：git ${command} ${command === 'switch' ? '-c' : '-b'} <branch>`);
      if (!clean()) throw new Error('請先提交或還原變更，再切換分支。');
      if (create) {
        git(['branch', name, ...args.slice(2)]);
      }
      if (!own(state.branches, name)) throw new Error(`找不到分支：${name}`);
      state.branch = name;
      loadHead();
      event('switch');
      if (name === 'main') event('switch-main');
      return `Switched to branch '${name}'`;
    }
    if (command === 'merge')
      return mergeCommit(resolve(args.find(arg => !arg.startsWith('-'))), `Merge branch '${args[0]}'`);
    if (command === 'restore') {
      const staged = args.includes('--staged') || args.includes('-S'),
        worktree = args.includes('--worktree') || args.includes('-W');
      const paths = args.filter(arg => !arg.startsWith('-'));
      if (!paths.length) throw new Error('用法：git restore [--staged] <file>');
      const source = staged ? headFiles() : state.index,
        target = staged ? state.index : state.files;
      const selected = paths.includes('.')
        ? [...new Set([...Object.keys(source), ...Object.keys(target)])]
        : paths.map(pathOf);
      for (const path of selected)
        if (!own(source, path) && !own(target, path)) throw new Error(`找不到檔案：${path}`);
      for (const path of selected) {
        if (!staged && !own(state.index, path)) continue;
        if (own(source, path)) target[path] = source[path];
        else delete target[path];
        if (staged && worktree) {
          if (own(source, path)) state.files[path] = source[path];
          else delete state.files[path];
        }
      }
      event('restore');
      return staged ? '已取消暫存，工作目錄內容保留。' : '已從暫存區還原工作目錄。';
    }
    if (command === 'reset') {
      const mode = args.includes('--soft') ? 'soft' : args.includes('--hard') ? 'hard' : 'mixed';
      const ref = args.find(arg => !arg.startsWith('-')) || 'HEAD',
        target = resolve(ref);
      const oldTracked = copy(state.index);
      state.branches[state.branch] = target;
      if (mode !== 'soft') state.index = copy(headFiles());
      if (mode === 'hard') {
        // Untracked files survive reset --hard unless replaced by a tracked path.
        const untracked = Object.fromEntries(
          Object.entries(state.files).filter(([path]) => !own(headFiles(), path) && !own(oldTracked, path)),
        );
        state.files = { ...untracked, ...copy(headFiles()) };
      }
      event(`reset-${mode}`);
      return `HEAD is now at ${target} ${state.commits[target].message} (${mode})`;
    }
    if (command === 'revert') {
      if (!clean()) throw new Error('請先提交或還原變更，再執行 revert。');
      const id = resolve(args.find(arg => !arg.startsWith('-')) || 'HEAD'),
        commit = state.commits[id];
      if (commit.parents.length > 1) throw new Error('教學模式不支援 revert 合併提交。');
      const before = state.commits[commit.parents[0]]?.files || {},
        result = copy(headFiles());
      for (const path of changes(before, commit.files)) {
        if (result[path] !== commit.files[path]) throw new Error(`revert 衝突：${path}。工作目錄未變更。`);
        if (own(before, path)) result[path] = before[path];
        else delete result[path];
      }
      state.branches[state.branch] = newCommit(`Revert "${commit.message}"`, result, [headId()]);
      loadHead();
      event('revert');
      return `[${state.branch} ${headId()}] Revert "${commit.message}"`;
    }
    if (command === 'remote') {
      if (args[0] === 'add') {
        if (args[1] !== 'origin' || !args[2]) throw new Error('用法：git remote add origin <url>');
        if (state.remote) throw new Error('remote origin already exists.');
        state.remote = { url: args[2], branches: {}, commits: {} };
        event('remote-add');
        return '已新增 origin。';
      }
      if (!args.length || args[0] === '-v')
        return state.remote
          ? args[0] === '-v'
            ? `origin\t${state.remote.url} (fetch)\norigin\t${state.remote.url} (push)`
            : 'origin'
          : '尚未設定遠端。';
      throw new Error('支援 git remote -v / git remote add origin <url>。');
    }
    if (command === 'fetch') {
      syncRemote();
      event('fetch');
      return 'From origin\n已更新 origin/* 遠端追蹤分支；工作目錄未變更。';
    }
    if (command === 'push') {
      if (!state.remote) throw new Error('尚未設定 origin。');
      const names = args.filter(arg => !arg.startsWith('-')),
        branch = names[0] === 'origin' ? names[1] || state.branch : names[0] || state.branch;
      if (names[0] && names[0] !== 'origin' && !own(state.branches, names[0]))
        throw new Error('教學模式使用 origin 遠端。');
      const id = own(state.branches, branch) ? state.branches[branch] : null;
      if (!id) throw new Error('找不到分支或尚無提交可推送。');
      const previous = state.remote.branches[branch];
      if (previous && !ancestors(id).has(previous)) {
        event('push-rejected');
        throw new Error(
          '! [rejected] non-fast-forward\n遠端有本機尚未整合的提交。請先 git pull，再 git push。',
        );
      }
      state.remote.branches[branch] = id;
      for (const commitId of ancestors(id)) state.remote.commits[commitId] = copy(state.commits[commitId]);
      state.remoteTracking[branch] = id;
      event('push');
      if (state.events.has('pull')) event('push-after-pull');
      return `To ${state.remote.url}\n${branch} -> ${branch}${previous === id ? '\nEverything up-to-date' : ''}`;
    }
    if (command === 'pull') {
      syncRemote();
      const branch = args.filter(arg => !arg.startsWith('-') && arg !== 'origin')[0] || state.branch;
      const id = state.remoteTracking[branch];
      if (!id) throw new Error(`遠端沒有 ${branch} 分支。`);
      const output = mergeCommit(id, `Merge remote-tracking branch 'origin/${branch}'`);
      event('pull');
      return `From origin\n${output}`;
    }
    if (command === 'help' || command === '--help') return help();
    throw new Error(`尚未支援 git ${command || ''}。輸入 help 查看可用指令。`);
  }
  function gh(args) {
    const [group, command] = args;
    const options = args.slice(2);
    if (group === 'auth') {
      if (command === 'login') {
        state.loggedIn = true;
        event('auth-login');
        return '✓ 已登入教學帳號 learner（本機模擬）。';
      }
      if (command === 'status') {
        event('auth-status');
        return state.loggedIn
          ? 'github.com\n  ✓ Logged in as learner (simulated)'
          : '尚未登入。執行 gh auth login 完成本機模擬登入。';
      }
    }
    if (!state.loggedIn) throw new Error('請先執行 gh auth login。');
    if (group === 'repo' && command === 'create') {
      const name = options.find(arg => !arg.startsWith('-')) || 'my-project';
      if (state.remote) throw new Error('此專案已設定 origin。');
      state.remote = {
        url: `https://github.com/${name.includes('/') ? name : `learner/${name}`}.git`,
        branches: {},
        commits: {},
      };
      event('repo-create');
      event('remote-add');
      return `✓ Created ${state.remote.url}${options.includes('--push') ? `\n${git(['push', '-u', 'origin', state.branch])}` : ''}`;
    }
    if (!state.remote) throw new Error('請先連接遠端 repository。');
    if (group === 'repo' && command === 'view')
      return `${state.remote.url}\n預設分支：main\n本機模擬 repository`;
    if (group === 'pr') {
      if (command === 'create') {
        const branch = flagValue(options, '--head', '-H') || state.branch,
          base = flagValue(options, '--base', '-B') || 'main';
        const title =
          flagValue(options, '--title', '-t') ||
          state.commits[state.branches[branch]]?.message ||
          'Update project';
        if (branch === base) throw new Error('PR 的來源與目標分支必須不同。');
        if (!state.remote.branches[branch] || !state.remote.branches[base])
          throw new Error('請先將來源與目標分支 push 到 origin。');
        const remoteSource = state.remote.commits[state.remote.branches[branch]],
          remoteBase = state.remote.commits[state.remote.branches[base]];
        if (same(remoteSource.files, remoteBase.files)) throw new Error('來源分支與目標分支沒有內容差異。');
        if (state.prs.some(pr => pr.head === branch && pr.base === base && pr.state === 'OPEN'))
          throw new Error('此分支已有開啟的 PR。');
        const pr = {
          number: state.prs.length + 1,
          title,
          body: flagValue(options, '--body', '-b') || '',
          head: branch,
          base,
          state: 'OPEN',
          status: 'open',
        };
        state.prs.push(pr);
        event('pr-create');
        return `Created pull request #${pr.number}: ${title}\n${state.remote.url.replace(/\.git$/, '')}/pull/${pr.number}`;
      }
      if (command === 'list')
        return (
          state.prs
            .filter(pr =>
              options.includes('all') || options.includes('closed') ? true : pr.state === 'OPEN',
            )
            .map(pr => `#${pr.number} ${pr.title} (${pr.head} → ${pr.base}) [${pr.state}]`)
            .join('\n') || 'No pull requests.'
        );
      const number = Number(options.find(arg => /^\d+$/.test(arg))),
        pr = number
          ? state.prs.find(item => item.number === number)
          : [...state.prs].reverse().find(item => item.head === state.branch);
      if (!pr) throw new Error('找不到 Pull Request。請使用 gh pr list。');
      if (command === 'view')
        return `#${pr.number} ${pr.title}\n${pr.head} → ${pr.base}\n${pr.state}\n${pr.body}`;
      if (command === 'merge') {
        if (pr.state !== 'OPEN') throw new Error('這個 PR 已經合併。');
        syncRemote();
        const baseId = state.remote.branches[pr.base],
          targetId = state.remote.branches[pr.head];
        const originalBranch = state.branch,
          originalBranches = copy(state.branches),
          originalFiles = copy(state.files),
          originalIndex = copy(state.index);
        // Merge in an isolated local view, then update only the server branch.
        try {
          state.branch = pr.base;
          state.branches[pr.base] = baseId;
          loadHead();
          mergeCommit(targetId, `Merge pull request #${pr.number}: ${pr.title}`, options.includes('--merge'));
          const id = headId();
          state.remote.branches[pr.base] = id;
          for (const commitId of ancestors(id))
            state.remote.commits[commitId] = copy(state.commits[commitId]);
          pr.state = 'MERGED';
          pr.status = 'merged';
          event('pr-merge');
        } finally {
          state.branch = originalBranch;
          state.branches = originalBranches;
          state.files = originalFiles;
          state.index = originalIndex;
        }
        return `✓ Merged pull request #${pr.number}.\n切換 ${pr.base} 後執行 git pull 同步本機。`;
      }
    }
    if (group === 'issue') {
      if (command === 'create') {
        const title = flagValue(options, '--title', '-t');
        if (!title) throw new Error('用法：gh issue create --title "標題" --body "內容"');
        const issue = {
          number: state.issues.length + 1,
          title,
          body: flagValue(options, '--body', '-b') || '',
          state: 'OPEN',
        };
        state.issues.push(issue);
        event('issue-create');
        return `Created issue #${issue.number}: ${title}`;
      }
      if (command === 'list')
        return (
          state.issues.map(issue => `#${issue.number} ${issue.title} [${issue.state}]`).join('\n') ||
          'No issues.'
        );
    }
    throw new Error('尚未支援此 gh 指令。輸入 help 查看可用指令。');
  }
  function help() {
    return [
      'Shell: ls · cat <file> · touch <file> · echo "text" > <file> · echo "text" >> <file> · rm <file> · pwd · clear',
      'Git: init · status · add · commit -m/-am · log --oneline · diff [--staged] · branch · switch [-c] · checkout [-b]',
      '     merge · restore [--staged] · reset --soft/--mixed/--hard HEAD~1 · revert HEAD',
      '     remote · push · fetch · pull · clone',
      'GitHub CLI: gh auth login/status · gh repo create/view · gh pr create/list/view/merge · gh issue create/list',
      '所有操作只在此分頁的教學模擬器執行。',
    ].join('\n');
  }

  function run(input) {
    try {
      const tokens = tokenize(input.trim());
      if (!tokens.length) return '';
      const [command, ...args] = tokens;
      if (command === 'git') return git(args);
      if (command === 'gh') return gh(args);
      if (command === 'help') return help();
      if (command === 'clear') {
        event('clear');
        return '';
      }
      if (command === 'pwd') return state.cwd;
      if (command === 'ls') return Object.keys(state.files).sort().join('\n') || '（空資料夾）';
      if (command === 'cat') {
        if (!args.length) throw new Error('用法：cat <file>');
        return args
          .map(pathOf)
          .map(path => {
            if (!own(state.files, path)) throw new Error(`cat: ${path}: No such file`);
            return state.files[path];
          })
          .join('');
      }
      if (command === 'touch') {
        if (!args.length) throw new Error('用法：touch <file>');
        const paths = args.map(pathOf);
        for (const path of paths) if (!own(state.files, path)) state.files[path] = '';
        event('edit');
        return '';
      }
      if (command === 'echo') {
        const redirect = args.findIndex(arg => arg === '>' || arg === '>>');
        const noNewline = args[0] === '-n';
        if (redirect === -1) return args.slice(noNewline ? 1 : 0).join(' ') + (noNewline ? '' : '\n');
        if (redirect !== args.length - 2) throw new Error('用法：echo "text" > <file>');
        const path = pathOf(args[redirect + 1]),
          content = args.slice(noNewline ? 1 : 0, redirect).join(' ') + (noNewline ? '' : '\n');
        state.files[path] = (args[redirect] === '>>' ? state.files[path] || '' : '') + content;
        event('edit');
        return '';
      }
      if (command === 'rm') {
        const paths = args.filter(arg => !arg.startsWith('-')).map(pathOf);
        if (!paths.length) throw new Error('用法：rm <file>');
        for (const path of paths) if (!own(state.files, path)) throw new Error(`rm: ${path}: No such file`);
        for (const path of paths) delete state.files[path];
        event('edit');
        return '';
      }
      throw new Error(`找不到指令：${command}。輸入 help 查看可用指令。`);
    } catch (error) {
      return `錯誤：${error.message}`;
    }
  }
  function colleaguePush() {
    if (!state.remote || !state.remote.branches.main) return '請先將 main 推送到 origin，才能模擬同事提交。';
    const parent = state.remote.branches.main;
    const files = copy(state.remote.commits[parent].files);
    files['team-notes.md'] =
      `${files['team-notes.md'] || '# Team notes\n'}同事新增的協作筆記 ${sequence + 1}\n`;
    // The remote object owns the new commit until fetch/pull is performed.
    const id = newCommit('Colleague updates team notes', files, [parent]);
    state.remote.commits[id] = copy(state.commits[id]);
    delete state.commits[id];
    state.remote.branches.main = id;
    event('colleague');
    return `同事已推送 ${id} 到 origin/main。本機尚未同步。`;
  }
  // Commits that some branch, HEAD or origin/* can still reach.
  // Anything outside this set was "left behind" (e.g. by reset) and only reflog could find it.
  function reachableCommits() {
    const tips = [...Object.values(state.branches), ...Object.values(state.remoteTracking)];
    const result = new Set();
    for (const tip of tips) for (const id of ancestors(tip)) result.add(id);
    return result;
  }

  const hasRemote = () => !!state.remote;

  return { state, run, colleaguePush, reachableCommits, hasRemote };
}
