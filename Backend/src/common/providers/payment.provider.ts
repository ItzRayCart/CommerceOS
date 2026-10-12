import { createHash } from 'node:crypto';
export interface PaymentProvider {
  charge(input: {
    amount: number;
    currency: string;
    method: 'card_mock' | 'cod';
    token?: string | undefined;
    orderRef: string;
  }): Promise<{
    status: 'paid' | 'unpaid' | 'failed';
    transactionId?: string;
    last4?: string;
    failureReason?: string;
  }>;
  refund(input: { transactionId: string; amount: number }): Promise<void>;
}
// These opaque fixtures are issued by the browser mock tokeniser. No PAN/CVC reaches this boundary.
const tokens: Record<string, { last4: string; failureReason?: string }> = {
  mock_approved: { last4: '4242' },
  mock_declined: { last4: '0002', failureReason: 'card_declined' },
  mock_insufficient: { last4: '9995', failureReason: 'insufficient_funds' },
};
export class MockPaymentProvider implements PaymentProvider {
  charge(input: Parameters<PaymentProvider['charge']>[0]): ReturnType<PaymentProvider['charge']> {
    if (input.method === 'cod') return Promise.resolve({ status: 'unpaid' });
    const fixture = tokens[input.token ?? ''];
    if (!fixture || fixture.failureReason)
      return Promise.resolve({
        status: 'failed',
        failureReason: fixture?.failureReason ?? 'invalid_token',
      });
    return Promise.resolve({
      status: 'paid',
      last4: fixture.last4,
      transactionId: `mock_${createHash('sha256').update(input.orderRef).digest('hex').slice(0, 24)}`,
    });
  }
  refund(): Promise<void> {
    return Promise.resolve();
  }
}
