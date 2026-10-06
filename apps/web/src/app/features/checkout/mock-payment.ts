export function luhn(number: string): boolean {
  if (!/^\d{13,19}$/.test(number)) return false;
  let sum = 0;
  let twice = false;
  for (let i = number.length - 1; i >= 0; i--) {
    let n = Number(number[i]);
    if (twice) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    twice = !twice;
  }
  return sum % 10 === 0;
}
export function tokenizeMockCard(
  number: string,
  expiry: string,
  cvc: string,
  now = new Date(),
): { method: 'card_mock'; token: string; last4: string } {
  const digits = number.replace(/[ -]/g, '');
  if (!luhn(digits)) throw new Error('Enter a valid card number.');
  const date = /^(0[1-9]|1[0-2])\s*\/\s*(\d{2})$/.exec(expiry);
  if (!date || new Date(2000 + Number(date[2]), Number(date[1]), 1) <= now)
    throw new Error('Enter a future expiry date in MM/YY format.');
  if (!/^\d{3}$/.test(cvc)) throw new Error('Enter a three-digit CVC.');
  const token =
    digits === '4242424242424242'
      ? 'mock_approved'
      : digits === '4000000000000002'
        ? 'mock_declined'
        : digits === '4000000000009995'
          ? 'mock_insufficient'
          : '';
  if (!token) throw new Error('Use one of the displayed mock test cards.');
  return { method: 'card_mock', token, last4: digits.slice(-4) };
}
