import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS, tokenize, createSimulator } from '../js/git-sim.js';

function ok(sim, command) {
  const result = sim.run(command);
  assert.ok(!result.startsWith('錯誤：'), `${command}: ${result}`);
  return result;
}
function commit(sim, file, content, message = 'Change file') {
  ok(sim, `echo "${content}" > ${file}`);
  ok(sim, 'git add .');
  ok(sim, `git commit -m "${message}"`);
  return sim.state.branches[sim.state.branch];
}

test('scenarios expose independent, deterministic state', () => {
  assert.deepEqual(
    SCENARIOS.map(s => s.id),
    ['empty', 'fresh-files', 'has-history', 'remote-ready', 'branching', 'gh-flow'],
  );
  for (const { id } of SCENARIOS) {
    const a = createSimulator(id),
      b = createSimulator(id);
    assert.deepEqual(a.state, b.state);
    a.state.files['only-a'] = 'a';
    assert.equal(b.state.files['only-a'], undefined);
  }
});

test('tokenizer preserves quoted spaces, empty words, escapes and redirects', () => {
  assert.deepEqual(tokenize(`echo 'hello world' > "my file.txt"`), [
    'echo',
    'hello world',
    '>',
    'my file.txt',
  ]);
  assert.deepEqual(tokenize('echo "" >>file'), ['echo', '', '>>', 'file']);
  assert.deepEqual(tokenize('git commit -m "say \\"hi\\""'.replaceAll('\\\\', '\\')), [
    'git',
    'commit',
    '-m',
    'say "hi"',
  ]);
  assert.throws(() => tokenize('echo "unfinished'), /引號/);
});

test('shell creates, appends, reads and removes quoted filenames', () => {
  const sim = createSimulator();
  ok(sim, 'echo "first line" > "my file.txt"');
  ok(sim, 'echo "second line" >> "my file.txt"');
  assert.equal(ok(sim, 'cat "my file.txt"'), 'first line\nsecond line\n');
  ok(sim, 'touch "my file.txt"');
  assert.equal(sim.state.files['my file.txt'], 'first line\nsecond line\n');
  assert.match(ok(sim, 'ls'), /my file.txt/);
  assert.match(ok(sim, 'pwd'), /workspace/);
  ok(sim, 'rm "my file.txt"');
  assert.deepEqual(sim.state.files, {});
  assert.match(sim.run('echo bad > ../outside'), /^錯誤/);
  assert.match(sim.run('git status'), /not a git repository/);
  assert.match(sim.run('sudo rm -rf /'), /找不到指令/);
});

test('staging is a snapshot independent of subsequent working tree edits', () => {
  const sim = createSimulator();
  ok(sim, 'git init');
  ok(sim, 'echo first > app.js');
  ok(sim, 'git add app.js');
  ok(sim, 'echo second > app.js');
  ok(sim, 'git commit -m "First snapshot"');
  const head = sim.state.commits[sim.state.branches.main];
  assert.equal(head.files['app.js'], 'first\n');
  assert.equal(sim.state.files['app.js'], 'second\n');
  assert.match(ok(sim, 'git status'), /Changes not staged/);
  assert.match(ok(sim, 'git diff'), /\+second/);
  assert.match(ok(sim, 'git log --oneline'), /First snapshot/);
  for (const event of ['init', 'add', 'commit', 'status', 'diff', 'log'])
    assert.ok(sim.state.events.has(event));
});

test('commit -am includes tracked changes and deletions but excludes untracked files', () => {
  const sim = createSimulator('branching');
  ok(sim, 'echo update > README.md');
  ok(sim, 'rm index.html');
  ok(sim, 'touch untracked.txt');
  ok(sim, 'git commit -am "Tracked only"');
  const files = sim.state.commits[sim.state.branches.main].files;
  assert.equal(files['README.md'], 'update\n');
  assert.equal(files['index.html'], undefined);
  assert.equal(files['untracked.txt'], undefined);
});

test('restore staged preserves working content, restore restores index snapshot', () => {
  const sim = createSimulator('branching'),
    original = sim.state.files['README.md'];
  ok(sim, 'echo updated > README.md');
  ok(sim, 'git add README.md');
  ok(sim, 'git restore --staged README.md');
  assert.equal(sim.state.index['README.md'], original);
  assert.equal(sim.state.files['README.md'], 'updated\n');
  ok(sim, 'git restore README.md');
  assert.equal(sim.state.files['README.md'], original);
  ok(sim, 'touch new.txt');
  ok(sim, 'git add new.txt');
  ok(sim, 'git restore --staged new.txt');
  assert.equal(sim.state.index['new.txt'], undefined);
  assert.equal(sim.state.files['new.txt'], '');
  assert.ok(sim.state.events.has('restore'));
});

test('soft, mixed and hard resets change the appropriate snapshots', () => {
  for (const mode of ['soft', 'mixed', 'hard']) {
    const sim = createSimulator('branching'),
      old = sim.state.branches.main,
      original = structuredClone(sim.state.files);
    commit(sim, 'new.txt', 'added');
    ok(sim, 'echo preserve > untracked.txt');
    ok(sim, `git reset --${mode} HEAD~1`);
    assert.equal(sim.state.branches.main, old);
    assert.equal(sim.state.index['new.txt'], mode === 'soft' ? 'added\n' : undefined);
    assert.equal(sim.state.files['new.txt'], mode === 'hard' ? undefined : 'added\n');
    assert.equal(sim.state.files['untracked.txt'], 'preserve\n');
    assert.equal(sim.state.files['README.md'], original['README.md']);
    assert.ok(sim.state.events.has(`reset-${mode}`));
  }
});

test('reset by hash retains commits and revert creates an inverse commit', () => {
  const sim = createSimulator('has-history'),
    previous = sim.state.branches.main;
  const before = structuredClone(sim.state.commits[sim.state.commits[previous].parents[0]].files);
  ok(sim, 'git revert HEAD');
  const reverted = sim.state.branches.main;
  assert.notEqual(reverted, previous);
  assert.deepEqual(sim.state.files, before);
  assert.deepEqual(sim.state.commits[reverted].parents, [previous]);
  ok(sim, `git reset --hard ${previous}`);
  assert.equal(sim.state.branches.main, previous);
  assert.ok(sim.state.commits[reverted]);
  assert.ok(sim.state.events.has('revert'));
});

test('branches support fast-forward and three-way merge', () => {
  const sim = createSimulator('branching');
  ok(sim, 'git switch -c feature');
  const feature = commit(sim, 'feature.txt', 'feature');
  ok(sim, 'git switch main');
  assert.match(ok(sim, 'git merge feature'), /Fast-forward/);
  assert.equal(sim.state.branches.main, feature);
  ok(sim, 'git checkout -b another');
  const another = commit(sim, 'another.txt', 'another');
  ok(sim, 'git checkout main');
  const main = commit(sim, 'main.txt', 'main');
  assert.match(ok(sim, 'git merge another'), /three-way/);
  assert.deepEqual(sim.state.commits[sim.state.branches.main].parents, [main, another]);
  assert.equal(sim.state.files['another.txt'], 'another\n');
  assert.equal(sim.state.files['main.txt'], 'main\n');
  for (const event of ['branch-create', 'switch-main', 'merge']) assert.ok(sim.state.events.has(event));
});

test('conflicting merges explain the simplified resolution and use incoming content', () => {
  const sim = createSimulator('branching');
  ok(sim, 'git switch -c feature');
  commit(sim, 'README.md', 'feature');
  ok(sim, 'git switch main');
  commit(sim, 'README.md', 'main');
  assert.match(ok(sim, 'git merge feature'), /教學簡化/);
  assert.equal(sim.state.files['README.md'], 'feature\n');
});

test('remote push rejects unseen colleague history; fetch does not alter local files', () => {
  const sim = createSimulator('remote-ready');
  sim.colleaguePush();
  const local = sim.state.branches.main,
    remote = sim.state.remote.branches.main;
  assert.notEqual(local, remote);
  assert.equal(sim.state.commits[remote], undefined);
  assert.match(sim.run('git push origin main'), /non-fast-forward/);
  ok(sim, 'git fetch');
  assert.equal(sim.state.branches.main, local);
  assert.equal(sim.state.files['team-notes.md'], undefined);
  assert.ok(sim.state.commits[remote]);
  ok(sim, 'git pull origin main');
  assert.equal(sim.state.branches.main, remote);
  assert.ok(sim.state.files['team-notes.md']);
  assert.equal(sim.state.events.has('push-after-pull'), false);
  ok(sim, 'git push');
  assert.equal(sim.state.events.has('push-after-pull'), true);
  for (const event of ['colleague', 'push-rejected', 'pull', 'push']) assert.ok(sim.state.events.has(event));
});

test('diverged remote and local changes integrate with a merge on pull', () => {
  const sim = createSimulator('remote-ready');
  const local = commit(sim, 'local.txt', 'local');
  sim.colleaguePush();
  const remote = sim.state.remote.branches.main;
  assert.match(sim.run('git push'), /rejected/);
  ok(sim, 'git pull');
  assert.deepEqual(sim.state.commits[sim.state.branches.main].parents, [local, remote]);
  ok(sim, 'git push');
  assert.equal(sim.state.remote.branches.main, sim.state.branches.main);
});

test('remote add and clone use simulated snapshots without network access', () => {
  const sim = createSimulator('branching');
  ok(sim, 'git remote add origin https://github.com/test/project.git');
  ok(sim, 'git push -u origin main');
  assert.equal(sim.state.remote.branches.main, sim.state.branches.main);
  assert.ok(sim.state.events.has('remote-add'));
  const cloned = createSimulator();
  ok(cloned, 'git clone https://github.com/test/project.git');
  assert.ok(cloned.state.initialized);
  assert.equal(cloned.state.cwd, '/workspace/project');
  assert.ok(cloned.state.files['README.md']);
});

test('full gh PR workflow preserves working tree on remote merge then allows pull', () => {
  const sim = createSimulator('gh-flow');
  assert.equal(sim.state.loggedIn, true);
  ok(sim, 'gh auth status');
  ok(sim, 'gh auth login');
  ok(sim, 'git switch -c feature');
  commit(sim, 'feature.txt', 'new feature');
  assert.match(sim.run('gh pr create --title "New feature"'), /push/);
  ok(sim, 'git push -u origin feature');
  ok(sim, 'gh pr create --title "New feature" --body "Please review"');
  assert.match(ok(sim, 'gh pr list'), /New feature/);
  assert.match(ok(sim, 'gh pr view 1'), /Please review/);
  ok(sim, 'git switch main');
  const oldMain = sim.state.branches.main;
  ok(sim, 'gh pr merge 1 --merge');
  assert.equal(sim.state.prs[0].state, 'MERGED');
  assert.equal(sim.state.remote.commits[sim.state.remote.branches.main].parents.length, 2);
  assert.equal(sim.state.branches.main, oldMain);
  assert.equal(sim.state.files['feature.txt'], undefined);
  ok(sim, 'git pull');
  assert.equal(sim.state.files['feature.txt'], 'new feature\n');
  for (const event of ['auth-status', 'pr-create', 'pr-merge']) assert.ok(sim.state.events.has(event));
});

test('gh creates repository and issue data', () => {
  const sim = createSimulator('branching');
  ok(sim, 'gh auth login');
  ok(sim, 'gh repo create sample --public --source . --push');
  assert.match(ok(sim, 'gh repo view'), /learner\/sample/);
  ok(sim, 'gh issue create --title "Fix layout" --body "Small screen"');
  assert.match(ok(sim, 'gh issue list'), /Fix layout/);
  assert.equal(sim.state.issues[0].body, 'Small screen');
});

test('errors do not record successful action events', () => {
  const sim = createSimulator('branching');
  assert.match(sim.run('git commit -m empty'), /^錯誤/);
  assert.equal(sim.state.events.has('commit'), false);
  const before = structuredClone(sim.state.index);
  assert.match(sim.run('git add README.md missing'), /^錯誤/);
  assert.deepEqual(sim.state.index, before);
  assert.equal(sim.state.events.has('add'), false);
});

test('branch switching protects dirty working files', () => {
  const sim = createSimulator('branching');
  ok(sim, 'git branch feature');
  ok(sim, 'echo changed > index.html');
  assert.match(sim.run('git switch feature'), /^錯誤/);
  assert.equal(sim.state.branch, 'main');
  assert.equal(sim.state.files['index.html'], 'changed\n');
  ok(sim, 'git restore index.html');
  ok(sim, 'git switch feature');
});

test('staging deletions records the deletion while log graph renders commits', () => {
  const sim = createSimulator('branching');
  ok(sim, 'rm style.css');
  assert.match(ok(sim, 'git status'), /deleted: style.css/);
  ok(sim, 'git add .');
  assert.match(ok(sim, 'git diff --staged'), /\/dev\/null/);
  ok(sim, 'git commit -m "Delete stylesheet"');
  assert.equal(sim.state.commits[sim.state.branches.main].files['style.css'], undefined);
  assert.match(ok(sim, 'git log --graph --oneline'), /^\* /);
});

test('reserved object keys and unknown commands cannot corrupt simulation', () => {
  const sim = createSimulator('branching');
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    assert.match(sim.run(`touch ${key}`), /^錯誤/);
    assert.match(sim.run(`git branch ${key}`), /^錯誤/);
    assert.equal(Object.hasOwn(sim.state.files, key), false);
    assert.equal(Object.hasOwn(sim.state.branches, key), false);
  }
  assert.match(sim.run('git frobnicate'), /尚未支援/);
  assert.match(sim.run('gh nope'), /auth login/);
  assert.equal(Object.getPrototypeOf(sim.state.files), Object.prototype);
});
test('unique abbreviated hashes resolve the intended commit', () => {
  const sim = createSimulator('has-history');
  const ids = Object.keys(sim.state.commits);
  assert.equal(new Set(ids.map(id => id.slice(0, 4))).size, ids.length);
  ok(sim, `git reset --hard ${ids[1].slice(0, 4)}`);
  assert.equal(sim.state.branches.main, ids[1]);
});

test('reset leaves commits unreachable; branches and origin/* keep them reachable', () => {
  const sim = createSimulator('has-history');
  const tip = sim.state.branches.main;
  assert.ok(sim.reachableCommits().has(tip));

  sim.run('git reset --hard HEAD~1');
  assert.equal(sim.reachableCommits().has(tip), false);

  sim.run(`git branch rescue ${tip}`);
  assert.ok(sim.reachableCommits().has(tip));
});

test('hasRemote reflects origin configuration', () => {
  const sim = createSimulator('has-history');
  assert.equal(sim.hasRemote(), false);
  sim.run('git remote add origin https://github.com/demo/site.git');
  assert.equal(sim.hasRemote(), true);
  assert.equal(createSimulator('gh-flow').hasRemote(), true);
});

test('commits record creation order for graph layout', () => {
  const sim = createSimulator('has-history');
  const orders = Object.values(sim.state.commits).map(commit => commit.order);
  assert.deepEqual(
    orders,
    [...orders].sort((a, b) => a - b),
  );
  assert.equal(new Set(orders).size, orders.length);
});
