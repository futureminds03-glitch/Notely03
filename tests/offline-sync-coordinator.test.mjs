import test from 'node:test';
import assert from 'node:assert/strict';
import { runOwnerSync } from '../lib/offline-sync-coordinator.js';

const tick = () => new Promise(resolve => setImmediate(resolve));

test('owner sync serializes concurrent workers', async () => {
  const order = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const first = runOwnerSync('owner-serial', async () => { order.push('first:start'); await gate; order.push('first:end'); });
  await tick();
  const second = runOwnerSync('owner-serial', async () => { order.push('second:start'); order.push('second:end'); });
  await tick();
  assert.deepEqual(order, ['first:start']);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(order, ['first:start', 'first:end', 'second:start', 'second:end']);
});

test('triggers received during a sync request one follow-up pass', async () => {
  let calls = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const first = runOwnerSync('owner-rerun', async () => { calls += 1; if (calls === 1) await gate; });
  await tick();
  const second = runOwnerSync('owner-rerun', async () => { calls += 1; });
  release();
  await Promise.all([first, second]);
  assert.equal(calls, 2);
});

test('different owners can sync independently', async () => {
  const order = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const first = runOwnerSync('owner-a', async () => { order.push('a:start'); await gate; order.push('a:end'); });
  const second = runOwnerSync('owner-b', async () => { order.push('b:start'); order.push('b:end'); });
  await tick();
  assert.deepEqual(order, ['a:start', 'b:start', 'b:end']);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(order, ['a:start', 'b:start', 'b:end', 'a:end']);
});
