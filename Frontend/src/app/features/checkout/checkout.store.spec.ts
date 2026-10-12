import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { OrderInput } from '@commerceos/shared';
import { AuthStore } from '@web/core/auth-session';
import { CheckoutStore } from './checkout.store';
const user = {
  id: '507f1f77bcf86cd799439011',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'Customer',
  role: 'customer' as const,
  status: 'active' as const,
};
const input: OrderInput = {
  address: {
    fullName: 'Test',
    line1: '10 Main',
    city: 'Lahore',
    region: 'Punjab',
    postalCode: '54000',
    country: 'PK',
    phone: '+923001234567',
  },
  shippingMethodCode: 'standard',
  payment: { method: 'card_mock', token: 'mock_approved', last4: '4242' },
};
describe('CheckoutStore submission safety', () => {
  let store: CheckoutStore;
  let http: HttpTestingController;
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(AuthStore).user.set(user);
    store = TestBed.inject(CheckoutStore);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });
  it('blocks double submit and preserves the exact key and payload after a network failure and reload', async () => {
    const first = store.submit(input);
    expect(await store.submit(input)).toBeNull();
    const request = http.expectOne('/api/v1/orders');
    const key = request.request.headers.get('Idempotency-Key');
    expect(key).toBeTruthy();
    expect(request.request.body).toEqual(input);
    expect(JSON.stringify(request.request.body)).not.toContain('4242424242424242');
    request.error(new ProgressEvent('network failure'));
    expect(await first).toBeNull();
    expect(store.pending()?.key).toBe(key);
    store.restore();
    const retry = store.submit();
    const repeated = http.expectOne('/api/v1/orders');
    expect(repeated.request.headers.get('Idempotency-Key')).toBe(key);
    expect(repeated.request.body).toEqual(input);
    repeated.flush({ data: { orderNumber: 'HLD-2026-000001' } });
    expect((await retry)?.orderNumber).toBe('HLD-2026-000001');
    expect(store.pending()).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });
  it('allows corrected payment after a confirmed decline with a fresh submission key', async () => {
    const first = store.submit(input);
    const request = http.expectOne('/api/v1/orders');
    const key = request.request.headers.get('Idempotency-Key');
    request.flush(
      { error: { message: 'Card declined' } },
      { status: 402, statusText: 'Payment Required' },
    );
    await first;
    expect(store.pending()).toBeNull();
    expect(store.error()).toBe('Card declined');
    const retry = store.submit({ ...input, payment: { method: 'cod' } });
    const next = http.expectOne('/api/v1/orders');
    expect(next.request.headers.get('Idempotency-Key')).not.toBe(key);
    next.flush({ data: { orderNumber: 'HLD-2026-000002' } });
    await retry;
  });
  it('clears stale quote data when the server rejects current stock', async () => {
    const pending = store.refresh(input);
    http
      .expectOne('/api/v1/checkout/quote')
      .flush({ error: { message: 'Stock unavailable' } }, { status: 409, statusText: 'Conflict' });
    expect(await pending).toBe(false);
    expect(store.quote()).toBeNull();
    expect(store.error()).toBe('Stock unavailable');
  });
  it('exposes validated server field messages for inline address feedback', async () => {
    const pending = store.refresh(input);
    http.expectOne('/api/v1/checkout/quote').flush(
      {
        error: {
          message: 'Address invalid',
          details: [{ path: 'address.line1', message: 'Street address is required' }],
        },
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    expect(await pending).toBe(false);
    expect(store.fieldErrors()).toEqual([
      { path: 'address.line1', message: 'Street address is required' },
    ]);
  });
});
