/** Compact remaining time ("3h 12m", "2d 4h", "5m") for chain-clock countdowns. */
export function formatDuration(seconds: bigint): string {
  const total = Number(seconds > 0n ? seconds : 0n);
  // Round up to whole minutes first so a partial minute carries into the hour.
  const totalMinutes = Math.ceil(total / 60);
  const hours = Math.floor(totalMinutes / 60),
    minutes = totalMinutes % 60;
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  return hours > 0 ? `${hours}h ${minutes}m` : `${Math.max(1, minutes)}m`;
}
