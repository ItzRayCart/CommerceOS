import { describe, it, expect } from 'vitest';
import { parseMinorUnits } from './money-input';
describe('configured currency price filters', () => {
  it('supports zero, two and three decimal currencies without dropping zero', () => {
    expect(parseMinorUnits(500, 0)).toBe(500);
    expect(parseMinorUnits('12.50', 2)).toBe(1250);
    expect(parseMinorUnits('1.234', 3)).toBe(1234);
    expect(parseMinorUnits(0, 0)).toBe(0);
    expect(parseMinorUnits('', 2)).toBeUndefined();
    expect(parseMinorUnits(null, 3)).toBeUndefined();
  });
  it('rejects negatives, fractional whole-unit currencies and unsafe or excess precision', () => {
    for (const [value, decimals] of [
      ['-1', 2],
      ['1.5', 0],
      ['1.234', 2],
      ['9007199254740992', 0],
      ['abc', 2],
    ] as const)
      expect(() => parseMinorUnits(value, decimals)).toThrow(RangeError);
  });
});
