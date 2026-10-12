// Currency amounts entered by a shopper become integer minor-unit filter values.
export function parseMinorUnits(
  value: string | number | null | undefined,
  decimals: number,
): number | undefined {
  if (value === null || value === undefined || String(value).trim() === '') return undefined;
  const text = String(value).trim();
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw new RangeError('Enter a non-negative price.');
  const [whole = '0', fraction = ''] = text.split('.');
  if (fraction.length > decimals) throw new RangeError(`Use at most ${decimals} decimal places.`);
  const result = Number(whole) * 10 ** decimals + Number(fraction.padEnd(decimals, '0'));
  if (!Number.isSafeInteger(result)) throw new RangeError('This price is too large.');
  return result;
}
