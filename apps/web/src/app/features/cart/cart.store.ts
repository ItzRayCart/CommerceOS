import { DOCUMENT } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '@web/core/auth-session';
import { errorMessage } from '@web/core/api-error';

export interface CartEntry {
  productId: string;
  variantId: string;
  quantity: number;
}
export interface CartLine extends CartEntry {
  id: string;
  name: string;
  slug: string;
  sku: string;
  variantLabel: string;
  image: string;
  unitPrice: number;
  lineTotal: number;
  available: number;
  unavailable: boolean;
  priceChanged: boolean;
}
export interface CartQuote {
  lines: CartLine[];
  discountCode: string | null;
  discountError: { reason: string; message: string } | null;
  currency: string;
  shippingMethod: { code: string; label: string; estimatedDays: number } | null;
  totals: { subtotal: number; discount: number; shipping: number; tax: number; total: number };
  canCheckout: boolean;
}
const EMPTY: CartQuote = {
  lines: [],
  discountCode: null,
  discountError: null,
  currency: 'USD',
  shippingMethod: null,
  totals: { subtotal: 0, discount: 0, shipping: 0, tax: 0, total: 0 },
  canCheckout: false,
};
const GUEST_KEY = 'commerceos:guest-cart:v1';
const PRICE_KEY = 'commerceos:last-prices:v1';
function readStorage<T>(storage: Storage | undefined, key: string, fallback: T): T {
  try {
    const raw = storage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function readGuest(storage: Storage | undefined): CartEntry[] {
  const value = readStorage<unknown>(storage, GUEST_KEY, []);
  if (!Array.isArray(value)) return [];
  return (value as unknown[]).filter(
    (item): item is CartEntry =>
      typeof item === 'object' &&
      item !== null &&
      'productId' in item &&
      typeof item.productId === 'string' &&
      'variantId' in item &&
      typeof item.variantId === 'string' &&
      'quantity' in item &&
      typeof item.quantity === 'number' &&
      Number.isInteger(item.quantity) &&
      item.quantity >= 1 &&
      item.quantity <= 10,
  );
}

@Injectable({ providedIn: 'root' })
export class CartStore {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthStore);
  private readonly storage = inject(DOCUMENT).defaultView?.localStorage;
  private guest = signal<CartEntry[]>(readGuest(this.storage));
  readonly quote = signal<CartQuote>(EMPTY);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly drawerOpen = signal(false);
  readonly count = computed(() =>
    this.auth.user()
      ? this.quote().lines.reduce((sum, line) => sum + line.quantity, 0)
      : this.guest().reduce((sum, line) => sum + line.quantity, 0),
  );
  readonly pendingMerge = computed(() => !!this.auth.user() && this.guest().length > 0);
  private lastPrices = readStorage<Record<string, number>>(this.storage, PRICE_KEY, {});
  private requestId = 0;
  private mergeInFlight: Promise<void> | null = null;
  constructor() {
    effect(() => {
      const user = this.auth.user();
      void (user ? this.mergeGuest() : this.load());
    });
  }
  private persistGuest() {
    this.storage?.setItem(GUEST_KEY, JSON.stringify(this.guest()));
  }
  private accept(value: CartQuote) {
    const lines = value.lines.map((line) => ({
      ...line,
      priceChanged:
        line.priceChanged ||
        (this.lastPrices[line.variantId] !== undefined &&
          this.lastPrices[line.variantId] !== line.unitPrice),
    }));
    this.quote.set({ ...value, lines });
    this.lastPrices = Object.fromEntries(lines.map((line) => [line.variantId, line.unitPrice]));
    this.storage?.setItem(PRICE_KEY, JSON.stringify(this.lastPrices));
  }
  async load() {
    const id = ++this.requestId;
    this.loading.set(true);
    this.error.set('');
    try {
      const result = this.auth.user()
        ? await firstValueFrom(this.http.get<{ data: CartQuote }>('/api/v1/cart'))
        : await firstValueFrom(
            this.http.post<{ data: CartQuote }>('/api/v1/cart/price', { items: this.guest() }),
          );
      if (id === this.requestId) this.accept(result.data);
    } catch (error) {
      if (id === this.requestId) this.error.set(errorMessage(error));
    } finally {
      if (id === this.requestId) this.loading.set(false);
    }
  }
  private mergeGuest(): Promise<void> {
    if (this.mergeInFlight) return this.mergeInFlight;
    const pending = this.performMerge().finally(() => {
      this.mergeInFlight = null;
    });
    this.mergeInFlight = pending;
    return pending;
  }
  async readyForCheckout(): Promise<void> {
    if (this.auth.user()) await this.mergeGuest();
    if (this.pendingMerge())
      throw new Error('Your guest cart could not be merged. Return to the cart and retry.');
  }
  private async performMerge() {
    const lines = this.guest();
    if (!lines.length) {
      await this.load();
      return;
    }
    this.busy.set(true);
    try {
      const result = await firstValueFrom(
        this.http.post<{ data: CartQuote }>('/api/v1/cart/merge', { items: lines }),
      );
      this.accept(result.data);
      this.guest.set([]);
      this.persistGuest();
      this.notice.set('Your saved cart has been merged.');
    } catch (error) {
      this.error.set(errorMessage(error, 'Your guest cart could not be merged. Please retry.'));
    } finally {
      this.busy.set(false);
    }
  }
  async retryMerge(): Promise<void> {
    if (this.pendingMerge() && !this.busy()) await this.mergeGuest();
  }
  async add(productId: string, variantId: string, quantity: number) {
    this.error.set('');
    this.notice.set('');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      this.error.set('Choose a whole quantity between 1 and 10.');
      return;
    }
    this.busy.set(true);
    try {
      if (this.auth.user()) {
        const result = await firstValueFrom(
          this.http.post<{ data: CartQuote }>('/api/v1/cart/items', {
            productId,
            variantId,
            quantity,
          }),
        );
        this.accept(result.data);
      } else {
        const entries = this.guest().map((item) => ({ ...item }));
        const current = entries.find((item) => item.variantId === variantId);
        if (current) current.quantity += quantity;
        else entries.push({ productId, variantId, quantity });
        if (current && current.quantity > 10)
          throw new Error('You can add at most 10 units of one variant.');
        const result = await firstValueFrom(
          this.http.post<{ data: CartQuote }>('/api/v1/cart/price', { items: entries }),
        );
        if (result.data.lines.some((line) => line.variantId === variantId && line.unavailable))
          throw new Error('The requested quantity is no longer available.');
        this.guest.set(entries);
        this.persistGuest();
        this.accept(result.data);
      }
      this.notice.set('Added to your cart.');
      this.drawerOpen.set(true);
    } catch (error) {
      this.error.set(
        error instanceof HttpErrorResponse
          ? errorMessage(error)
          : error instanceof Error
            ? error.message
            : errorMessage(error),
      );
    } finally {
      this.busy.set(false);
    }
  }
  async update(id: string, quantity: number) {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      this.error.set('Choose a whole quantity between 1 and 10.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      if (this.auth.user()) {
        const result = await firstValueFrom(
          this.http.patch<{ data: CartQuote }>(`/api/v1/cart/items/${id}`, { quantity }),
        );
        this.accept(result.data);
      } else {
        const entries = this.guest().map((item) =>
          item.variantId === id ? { ...item, quantity } : item,
        );
        const result = await firstValueFrom(
          this.http.post<{ data: CartQuote }>('/api/v1/cart/price', { items: entries }),
        );
        if (result.data.lines.some((line) => line.variantId === id && line.unavailable)) {
          throw new Error('The requested quantity is no longer available.');
        }
        this.guest.set(entries);
        this.persistGuest();
        this.accept(result.data);
      }
    } catch (error) {
      this.error.set(
        error instanceof Error && !(error instanceof HttpErrorResponse)
          ? error.message
          : errorMessage(error),
      );
    } finally {
      this.busy.set(false);
    }
  }
  async remove(id: string) {
    this.busy.set(true);
    this.error.set('');
    try {
      if (this.auth.user()) await firstValueFrom(this.http.delete(`/api/v1/cart/items/${id}`));
      else {
        this.guest.update((items) => items.filter((item) => item.variantId !== id));
        this.persistGuest();
      }
      await this.load();
      this.notice.set('Item removed.');
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
  async clear() {
    this.busy.set(true);
    this.error.set('');
    try {
      if (this.auth.user()) await firstValueFrom(this.http.delete('/api/v1/cart'));
      else {
        this.guest.set([]);
        this.persistGuest();
      }
      await this.load();
      this.notice.set('Your cart is empty.');
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
  async applyDiscount(code: string) {
    if (!this.auth.user()) {
      this.error.set('Sign in to apply a discount code. Your cart will be saved.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const result = await firstValueFrom(
        this.http.post<{ data: CartQuote }>('/api/v1/cart/discount', { code }),
      );
      this.accept(result.data);
      this.notice.set('Discount applied.');
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
  async removeDiscount() {
    this.busy.set(true);
    try {
      await firstValueFrom(this.http.delete('/api/v1/cart/discount'));
      await this.load();
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
