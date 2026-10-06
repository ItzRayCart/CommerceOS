import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CatalogApi } from '@web/features/catalog/catalog.api';
import type { StoreSettings } from '@web/features/catalog/catalog.types';

@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly api = inject(CatalogApi);
  private readonly document = inject(DOCUMENT);
  readonly data = signal<StoreSettings | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);

  async load(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(false);
    try {
      const response = await firstValueFrom(this.api.settings());
      this.data.set(response.data);
      this.document.documentElement.style.setProperty('--color-ink', response.data.theme.primary);
      this.document.documentElement.style.setProperty('--color-accent', response.data.theme.accent);
      this.document.title = `${response.data.store.name} — ${response.data.store.tagline}`;
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  formatMoney(cents: number): string {
    const currency = this.data()?.currency;
    if (!currency) return (cents / 100).toFixed(2);
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.code,
      minimumFractionDigits: currency.decimals,
    })
      .formatToParts(cents / 10 ** currency.decimals)
      .map((part) => (part.type === 'currency' ? currency.symbol : part.value))
      .join('');
  }
}
