import test from 'node:test';
import assert from 'node:assert/strict';
import { STATE_MACHINES, transition, canTransition } from '../lib/state-machines.js';

test('every registered machine has a valid initial state', () => {
  for (const [name, machine] of Object.entries(STATE_MACHINES)) {
    assert.ok(machine.transitions[machine.initial], name + ' initial state is registered');
  }
});

test('every transition target is a registered state', () => {
  for (const [name, machine] of Object.entries(STATE_MACHINES)) {
    const states = new Set(Object.keys(machine.transitions));
    for (const [state, events] of Object.entries(machine.transitions)) {
      for (const [event, target] of Object.entries(events)) {
        assert.ok(states.has(target), name + '.' + state + ' --' + event + '--> ' + target);
      }
    }
  }
});

test('note sync lifecycle supports create, update, delete and conflict recovery', () => {
  assert.equal(transition('noteSync', 'clean', 'CREATE'), 'pendingCreate');
  assert.equal(transition('noteSync', 'pendingCreate', 'START'), 'creating');
  assert.equal(transition('noteSync', 'creating', 'CONFLICT'), 'pendingUpdate');
  assert.equal(transition('noteSync', 'pendingUpdate', 'START'), 'updating');
  assert.equal(transition('noteSync', 'updating', 'SYNCED'), 'clean');
  assert.equal(transition('noteSync', 'clean', 'DELETE'), 'pendingDelete');
  assert.equal(transition('noteSync', 'pendingDelete', 'START'), 'deleting');
  assert.equal(transition('noteSync', 'deleting', 'DELETED'), 'clean');
});

test('delete tombstone wins over in-flight create or update', () => {
  assert.equal(transition('noteSync', 'creating', 'DELETE'), 'pendingDelete');
  assert.equal(transition('noteSync', 'updating', 'DELETE'), 'pendingDelete');
  assert.equal(transition('parkingSync', 'creating', 'DELETE'), 'pendingDelete');
});

test('failed work must be explicitly retried or discarded', () => {
  assert.equal(transition('noteSync', 'blocked', 'RETRY'), 'pendingUpdate');
  assert.equal(transition('parkingSync', 'blocked', 'DISCARD'), 'clean');
  assert.equal(canTransition('noteSync', 'blocked', 'SYNCED'), false);
  assert.throws(() => transition('noteSync', 'blocked', 'SYNCED'), /Illegal transition/);
});

test('stale AI responses and cancelled async tasks cannot complete', () => {
  assert.equal(transition('aiTask', 'running', 'STALE'), 'stale');
  assert.equal(canTransition('aiTask', 'stale', 'SUCCESS'), false);
  assert.equal(transition('aiTask', 'running', 'CANCEL'), 'cancelled');
});

test('history restore returns to the latest version only after save', () => {
  assert.equal(transition('history', 'followingLatest', 'SELECT_VERSION'), 'browsing');
  assert.equal(transition('history', 'browsing', 'RESTORE'), 'restoring');
  assert.equal(transition('history', 'restoring', 'SAVED'), 'followingLatest');
  assert.equal(canTransition('history', 'restoring', 'SELECT_VERSION'), false);
});

test('connectivity and workspace recovery paths are explicit', () => {
  assert.equal(transition('workspace', 'ready', 'OFFLINE'), 'readyOffline');
  assert.equal(transition('workspace', 'readyOffline', 'ONLINE'), 'syncing');
  assert.equal(transition('workspace', 'syncing', 'SYNCED'), 'ready');
  assert.equal(transition('workspace', 'syncing', 'SYNC_FAILED'), 'readyOffline');
});

test('voice capture cannot receive results before the microphone starts', () => {
  assert.equal(canTransition('voice', 'idle', 'RESULT'), false);
  assert.equal(transition('voice', 'starting', 'STARTED'), 'listening');
  assert.equal(transition('voice', 'listening', 'STOP'), 'stopping');
  assert.equal(transition('voice', 'stopping', 'ENDED'), 'idle');
});
