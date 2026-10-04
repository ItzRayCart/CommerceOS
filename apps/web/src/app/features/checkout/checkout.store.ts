import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { CheckoutInput, CheckoutQuote, OrderInput, OrderView } from '@commerceos/shared';
import { AuthStore } from '@web/core/auth-session';
import { errorMessage } from '@web/core/api-error';
import { CheckoutApi } from './checkout.api';
interface PendingOrder {
  key: string;
  input: OrderInput;
}
@Injectable({ providedIn: 'root' })
export class CheckoutStore {
  private readonly api = inject(CheckoutApi);
  private readonly auth = inject(AuthStore);
  private readonly window = inject(DOCUMENT).defaultView;
  readonly quote = signal<CheckoutQuote | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly fieldErrors = signal<{ path: string; message: string }[]>([]);
  readonly pending = signal<PendingOrder | null>(null);
  private storageKey() {
    return `commerceos:checkout:${this.auth.user()?.id ?? ''}`;
  }
  restore() {
    this.quote.set(null);
    this.error.set('');
    this.pending.set(null);
    try {
      const raw = this.window?.sessionStorage.getItem(this.storageKey());
      if (raw) this.pending.set(JSON.parse(raw) as PendingOrder);
    } catch {
      /* Storage is optional. */
    }
  }
  private clearPending() {
    this.pending.set(null);
    try {
      this.window?.sessionStorage.removeItem(this.storageKey());
    } catch {
      /* Storage is optional. */
    }
  }
  async refresh(input: CheckoutInput): Promise<boolean> {
    if (this.busy()) return false;
    this.busy.set(true);
    this.error.set('');
    this.fieldErrors.set([]);
    try {
      this.quote.set((await firstValueFrom(this.api.quote(input))).data);
      return true;
    } catch (error) {
      this.quote.set(null);
      this.error.set(errorMessage(error));
      this.captureFieldErrors(error);
      return false;
    } finally {
      this.busy.set(false);
    }
  }
  async submit(input?: OrderInput): Promise<OrderView | null> {
    if (this.busy()) return null;
    this.busy.set(true);
    this.error.set('');
    this.fieldErrors.set([]);
    let pending = this.pending();
    if (!pending && input) {
      pending = { key: crypto.randomUUID(), input };
      this.pending.set(pending);
      try {
        this.window?.sessionStorage.setItem(this.storageKey(), JSON.stringify(pending));
      } catch {
        /* The in-memory key still protects retries. */
      }
    }
    if (!pending) {
      this.busy.set(false);
      return null;
    }
    try {
      const order = (await firstValueFrom(this.api.place(pending.input, pending.key))).data;
      this.clearPending();
      return order;
    } catch (error) {
      // A network/server failure may follow a commit. Retain the exact key and payload until resolved.
      if (
        error instanceof HttpErrorResponse &&
        [400, 402, 403, 404, 409, 422].includes(error.status)
      )
        this.clearPending();
      this.error.set(errorMessage(error));
      this.captureFieldErrors(error);
      return null;
    } finally {
      this.busy.set(false);
    }
  }
  private captureFieldErrors(error: unknown) {
    if (!(error instanceof HttpErrorResponse)) return;
    const body: unknown = error.error;
    if (typeof body !== 'object' || body === null || !('error' in body)) return;
    const envelope: unknown = body.error;
    if (
      typeof envelope !== 'object' ||
      envelope === null ||
      !('details' in envelope) ||
      !Array.isArray(envelope.details)
    )
      return;
    const errors: { path: string; message: string }[] = [];
    for (const entry of envelope.details as unknown[]) {
      if (
        typeof entry === 'object' &&
        entry !== null &&
        'path' in entry &&
        typeof entry.path === 'string' &&
        'message' in entry &&
        typeof entry.message === 'string'
      )
        errors.push({ path: entry.path, message: entry.message });
    }
    this.fieldErrors.set(errors);
  }
}
