import test from 'node:test';
import assert from 'node:assert/strict';
import { LAB_GROUPS, LAB_SCENARIOS, createLabSimulator } from '../js/lab-scenarios.js';

// 這些「試試看」指令本來就是要示範被拒絕的情況
const EXPECTED_ERRORS = new Set(['delete-branch:git branch -d feature', 'push-rejected:git push#0']);

test('every lab scenario builds and its suggested commands run', () => {
  const groups = new Set(LAB_GROUPS.map(group => group.id));
  const ids = new Set();
  for (const scenario of LAB_SCENARIOS) {
    assert.ok(groups.has(scenario.group), scenario.id);
    assert.ok(!ids.has(scenario.id), `duplicate ${scenario.id}`);
    ids.add(scenario.id);

    const sim = createLabSimulator(scenario.id);
    assert.equal(sim.state.events.size, 0, `${scenario.id} starts with clean events`);
    const seen = {};
    for (const command of scenario.try) {
      const nth = (seen[command] = (seen[command] ?? -1) + 1);
      const output = sim.run(command);
      const key = EXPECTED_ERRORS.has(`${scenario.id}:${command}`)
        ? `${scenario.id}:${command}`
        : `${scenario.id}:${command}#${nth}`;
      if (EXPECTED_ERRORS.has(key)) assert.match(output, /^錯誤/, key);
      else assert.ok(!output.startsWith('錯誤'), `${scenario.id}: ${command} → ${output}`);
    }
  }
});

test('rebase scenario starts diverged and ends linear', () => {
  const sim = createLabSimulator('rebase');
  assert.equal(sim.state.branch, 'develop');
  const main = sim.state.branches.main;
  sim.run('git rebase main');
  let id = sim.state.branches.develop;
  for (let i = 0; i < 3; i++) id = sim.state.commits[id].parents[0];
  assert.equal(id, main);
});

test('fetch scenario moves origin/main but not main', () => {
  const sim = createLabSimulator('fetch');
  const main = sim.state.branches.main;
  sim.run('git fetch');
  assert.equal(sim.state.branches.main, main);
  assert.notEqual(sim.state.remoteTracking.main, main);
  sim.run('git merge origin/main');
  assert.equal(sim.state.branches.main, sim.state.remoteTracking.main);
});

test('push-rejected scenario needs pull before push', () => {
  const sim = createLabSimulator('push-rejected');
  assert.match(sim.run('git push'), /rejected/);
  sim.run('git pull');
  assert.doesNotMatch(sim.run('git push'), /^錯誤/);
  assert.equal(sim.state.remote.branches.main, sim.state.branches.main);
});
