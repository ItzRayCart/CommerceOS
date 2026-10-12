import { inject, Injectable } from '@angular/core';
import { ApiClient } from '@web/core/api-client';
import type { CheckoutInput, CheckoutQuote, OrderInput, OrderView } from '@commerceos/shared';
@Injectable({ providedIn: 'root' })
export class CheckoutApi {
  private readonly api = inject(ApiClient);
  quote(input: CheckoutInput) {
    return this.api.post<CheckoutQuote, CheckoutInput>('/checkout/quote', input);
  }
  place(input: OrderInput, key: string) {
    return this.api.post<OrderView, OrderInput>('/orders', input, { 'Idempotency-Key': key });
  }
  orders(page: number, status?: string) {
    return this.api.get<OrderView[]>('/orders', { page, limit: 12, ...(status ? { status } : {}) });
  }
  order(number: string) {
    return this.api.get<OrderView>(`/orders/${encodeURIComponent(number)}`);
  }
  cancel(number: string) {
    return this.api.post<OrderView, object>(`/orders/${encodeURIComponent(number)}/cancel`, {});
  }
}
