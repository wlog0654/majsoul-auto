// Matches the current official client's isPassedRefreshTimeServer: UTC 21:00 reset.
export function ticketStatus(info, nowSeconds) {
  if (!info || !Number.isFinite(Number(info.end_time)) || Number(info.end_time) <= nowSeconds) return 'inactive';
  const last = Number(info.last_pay_time || 0);
  if (!Number.isFinite(last) || last < 0 || last > nowSeconds + 300) throw new Error('INVALID_TICKET_TIME');
  return Math.floor((last + 10800) / 86400) === Math.floor((nowSeconds + 10800) / 86400) ? 'already_claimed' : 'claimable';
}
