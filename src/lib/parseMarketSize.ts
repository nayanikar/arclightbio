/** Parse legacy market_size strings like "~$5B" into USD billions. */
export function parseMarketSizeUsdB(value: string | undefined | null): number | null {
  if (!value) return null;
  const match = value.match(/\$?\s*([\d.]+)\s*([bmk])?/i);
  if (!match) return null;
  const num = parseFloat(match[1]);
  if (Number.isNaN(num)) return null;
  const unit = (match[2] ?? "b").toLowerCase();
  if (unit === "m") return num / 1000;
  if (unit === "k") return num / 1_000_000;
  return num;
}

export function formatMarketSizeUsdB(usdB: number): string {
  return `$${usdB.toFixed(1)}B`;
}
