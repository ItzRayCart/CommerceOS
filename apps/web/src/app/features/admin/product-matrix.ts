import type { AdminVariant } from '@commerceos/shared';
export function generateMatrix(
  options: { name: string; values: string[] }[],
  prefix: string,
  previous: AdminVariant[],
): AdminVariant[] {
  let combinations: Record<string, string>[] = [{}];
  for (const option of options) {
    if (!option.name.trim() || !option.values.length)
      throw new Error('Each option needs a name and values.');
    combinations = combinations.flatMap((c) =>
      option.values.map((v) => ({ ...c, [option.name]: v })),
    );
  }
  if (combinations.length > 8000) throw new Error('A product supports at most 8,000 combinations.');
  const key = (v: Record<string, string>) => JSON.stringify(Object.entries(v).sort());
  return combinations.map((options, i) => {
    const old = previous.find((v) => key(v.options) === key(options));
    return (
      old ?? {
        sku: `${
          prefix
            .toUpperCase()
            .replace(/[^A-Z0-9_-]/g, '')
            .slice(0, 40) || 'NEW'
        }-${i + 1}`,
        options,
        price: 0,
        stock: 0,
        lowStockThreshold: 5,
        isActive: true,
        images: [],
      }
    );
  });
}
