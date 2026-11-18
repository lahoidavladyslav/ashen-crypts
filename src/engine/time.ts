export function dayKey(now: number): string {
  const date = new Date(now);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function daysBetween(fromKey: string, toKey: string): number {
  const toUtc = (key: string): number => {
    const [year, month, day] = key.split("-").map(Number);
    return Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1);
  };
  return Math.round((toUtc(toKey) - toUtc(fromKey)) / 86_400_000);
}
