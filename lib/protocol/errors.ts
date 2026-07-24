const transportFailurePattern =
  /HTTP request failed|Failed to fetch|fetch failed|ECONNREFUSED|network error|network request failed/i;

export function describeTransportFailure(message: string): string | null {
  return transportFailurePattern.test(message) ? "Local Anvil unavailable." : null;
}
