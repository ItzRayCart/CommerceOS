import { luhn, tokenizeMockCard } from './mock-payment';
describe('browser mock payment boundary', () => {
  const now = new Date('2026-10-03T12:00:00Z');
  it('validates Luhn, expiry and CVC before producing an opaque token', () => {
    expect(luhn('4242424242424242')).toBe(true);
    expect(luhn('4242424242424241')).toBe(false);
    expect(() => tokenizeMockCard('4242424242424241', '12/30', '123', now)).toThrow('valid card');
    expect(() => tokenizeMockCard('4242424242424242', '09/26', '123', now)).toThrow(
      'future expiry',
    );
    expect(() => tokenizeMockCard('4242424242424242', '12/30', '12', now)).toThrow('three-digit');
    expect(() => tokenizeMockCard('4242424242424242', '13/30', '123', now)).toThrow();
  });
  it.each([
    ['4242 4242 4242 4242', 'mock_approved', '4242'],
    ['4000 0000 0000 0002', 'mock_declined', '0002'],
    ['4000 0000 0000 9995', 'mock_insufficient', '9995'],
  ])('tokenises %s without returning PAN/CVC', (number, token, last4) => {
    const result = tokenizeMockCard(number, '12/30', '123', now);
    expect(result).toEqual({ method: 'card_mock', token, last4 });
    expect(JSON.stringify(result)).not.toContain(number.replaceAll(' ', ''));
    expect(JSON.stringify(result)).not.toContain('cvc');
  });
});
