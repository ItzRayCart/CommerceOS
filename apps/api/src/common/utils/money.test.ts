import { percentageDiscount, taxHalfUp } from './money.js';
describe('BR-01 exact minor-unit arithmetic', () => {
  it('rounds half-up once at tax, including decimal rates and zero', () => {
    expect(taxHalfUp(101, 50)).toBe(51);
    expect(taxHalfUp(10, 5)).toBe(1);
    expect(taxHalfUp(1000, 8.125)).toBe(81);
    expect(taxHalfUp(0, 8)).toBe(0);
    expect(taxHalfUp(20000 - 2000, 8)).toBe(1440);
  });
  it('avoids floating-point multiplication errors for safe large amounts', () => {
    expect(percentageDiscount(Number.MAX_SAFE_INTEGER, 99)).toBe(
      Number((BigInt(Number.MAX_SAFE_INTEGER) * 99n) / 100n),
    );
    expect(percentageDiscount(101, 10)).toBe(10);
    expect(() => taxHalfUp(Number.MAX_SAFE_INTEGER + 1, 8)).toThrow();
    expect(() => taxHalfUp(-1, 8)).toThrow();
    expect(() => taxHalfUp(1, -1)).toThrow();
    expect(() => percentageDiscount(100, 101)).toThrow();
  });
});
