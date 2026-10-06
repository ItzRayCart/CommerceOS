import { AppError } from '@api/common/errors/app-error.js';
export function assertMoney(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount < 0)
    throw new AppError(422, 'VALIDATION_ERROR', 'The order amount is outside the supported range.');
}
function decimalFraction(value: number): [bigint, bigint] {
  if (!Number.isFinite(value) || value < 0)
    throw new AppError(422, 'VALIDATION_ERROR', 'The tax rate is invalid.');
  const [base = '0', exponent = '0'] = String(value).split('e');
  const [whole = '0', fraction = ''] = base.split('.');
  const scale = fraction.length - Number(exponent);
  const numerator = BigInt(whole + fraction);
  return scale >= 0 ? [numerator, 10n ** BigInt(scale)] : [numerator * 10n ** BigInt(-scale), 1n];
}
export function taxHalfUp(amount: number, ratePercent: number): number {
  assertMoney(amount);
  const [rate, scale] = decimalFraction(ratePercent);
  const numerator = BigInt(amount) * rate;
  const denominator = scale * 100n;
  const tax = Number((numerator * 2n + denominator) / (denominator * 2n));
  assertMoney(tax);
  return tax;
}
export function percentageDiscount(amount: number, percent: number): number {
  assertMoney(amount);
  if (!Number.isInteger(percent) || percent < 1 || percent > 100)
    throw new AppError(422, 'VALIDATION_ERROR', 'The discount percentage is invalid.');
  // Fractional minor units are discarded for percentage discounts; only tax rounds half-up.
  return Number((BigInt(amount) * BigInt(percent)) / 100n);
}
