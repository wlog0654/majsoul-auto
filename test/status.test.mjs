import test from 'node:test';
import assert from 'node:assert/strict';
import { ticketStatus } from '../status.mjs';
const reset = Date.parse('2026-11-10T21:00:00Z') / 1000;
test('game day resets at UTC 21:00 (Beijing 05:00)', () => {
  const info = {end_time: reset + 86400, last_pay_time: reset - 10};
  assert.equal(ticketStatus(info, reset - 1), 'already_claimed');
  assert.equal(ticketStatus(info, reset), 'claimable');
});
test('confirmed reward is idempotent', () => {
  assert.equal(ticketStatus({end_time: reset + 86400, last_pay_time: reset + 1}, reset + 60), 'already_claimed');
});
test('missing and expired cards do not trigger a claim', () => {
  assert.equal(ticketStatus(null, reset), 'inactive');
  assert.equal(ticketStatus({end_time: reset, last_pay_time: 0}, reset), 'inactive');
});
test('invalid timestamps fail closed', () => {
  assert.throws(() => ticketStatus({end_time: reset + 86400, last_pay_time: reset + 1000}, reset));
});
