import { generateMatrix } from './product-matrix';
describe('product variant matrix', () => {
  it('generates six category-agnostic combinations with unique SKUs', () => {
    const variants = generateMatrix(
      [
        { name: 'Color', values: ['Black', 'Sand', 'Blue'] },
        { name: 'Storage', values: ['128', '256'] },
      ],
      'TEST',
      [],
    );
    expect(variants).toHaveLength(6);
    expect(new Set(variants.map((v) => v.sku)).size).toBe(6);
    expect(variants[5]?.options).toEqual({ Color: 'Blue', Storage: '256' });
  });
  it('preserves existing variant identity, stock and price during regeneration', () => {
    const variants = generateMatrix([{ name: 'Size', values: ['Small'] }], 'TEST', []);
    const first = variants[0];
    if (!first) throw new Error('Missing fixture');
    first.id = 'existing';
    first.stock = 12;
    first.price = 15000;
    const regenerated = generateMatrix(
      [{ name: 'Size', values: ['Small', 'Large'] }],
      'TEST',
      variants,
    );
    expect(regenerated[0]).toBe(first);
    expect(regenerated[1]?.id).toBeUndefined();
  });
  it('supports a default variant and rejects incomplete options', () => {
    expect(generateMatrix([], 'TEST', [])).toHaveLength(1);
    expect(() => generateMatrix([{ name: '', values: ['Bad'] }], 'TEST', [])).toThrow();
  });
});
