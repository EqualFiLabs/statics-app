const GENESIS_SUPPLY = 5_555n;

export function nextAvailableGenesisId(circulatingIds: readonly bigint[]): bigint | null {
  const circulating = new Set(circulatingIds.map(String));
  for (let id = 1n; id <= GENESIS_SUPPLY; id += 1n) {
    if (!circulating.has(id.toString())) return id;
  }
  return null;
}
