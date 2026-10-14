import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { SCENARIOS, createSimulator } from '../js/git-sim.js';
import { MISSIONS } from '../js/missions.js';
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
test('all mounted scenarios and missions exist', () => {
  const scenarios = new Set(SCENARIOS.map(s => s.id));
  for (const match of html.matchAll(/data-scenario="([^"]+)"/g)) assert.ok(scenarios.has(match[1]), match[1]);
  for (const match of html.matchAll(/data-mission="([^"]+)"/g)) assert.ok(MISSIONS[match[1]], match[1]);
  assert.equal([...html.matchAll(/class="chapter"/g)].length, 13);
});
test('linked local assets exist and tabs reference unique panels', async () => {
  for (const [, path] of html.matchAll(/(?:src|href)="((?:css|js)\/[^\"]+)"/g))
    await access(new URL(`../${path}`, import.meta.url));
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size);
  for (const [, id] of html.matchAll(/data-tab="([^"]+)"/g)) assert.ok(ids.includes(id), id);
});
test('guided mission hints can complete every exercise', () => {
  const scenario = {
    'first-commit': 'fresh-files',
    'next-commit': 'has-history',
    branch: 'branching',
    undo: 'has-history',
    remote: 'has-history',
    gh: 'gh-flow',
  };
  for (const [name, initial] of Object.entries(scenario)) {
    const sim = createSimulator(initial);
    const completed = new Set();
    let current = sim;
    for (const [i, step] of MISSIONS[name].steps.entries()) {
      if (name === 'undo' && i > 0) current = createSimulator(initial);
      if (step.hint)
        for (const command of step.hint.split('\n')) {
          const result = current.run(command);
          if (!(
            name === 'remote' &&
            command === 'git push' &&
            current.state.events.has('push-rejected') &&
            !current.state.events.has('pull')
          ))
            assert.ok(!result.startsWith('錯誤：'), `${name}: ${command}: ${result}`);
        }
      else current.colleaguePush();
      assert.ok(step.check(current.state), `${name} step ${i + 1}: ${step.text}`);
      completed.add(i);
    }
    assert.equal(completed.size, MISSIONS[name].steps.length);
  }
});
test('remote mission requires a real push after pull', () => {
  const sim = createSimulator('has-history');
  sim.run('git remote add origin https://github.com/demo/site.git');
  sim.run('git push -u origin main');
  sim.colleaguePush();
  sim.run('git push');
  sim.run('git pull');
  const last = MISSIONS.remote.steps.at(-1);
  assert.equal(last.check(sim.state), false);
  sim.run('git push');
  assert.equal(last.check(sim.state), true);
});
test('runtime resources are local with no package dependencies', async () => {
  for (const [, link] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (/^https?:/.test(link)) assert.ok(html.includes(`href="${link}"`), 'external runtime resource');
  }
  const css = await readFile(new URL('../css/style.css', import.meta.url), 'utf8');
  assert.ok(!/@import|url\(\s*["']?https?:/i.test(css));
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.ok(!pkg.dependencies && !pkg.devDependencies);
});
