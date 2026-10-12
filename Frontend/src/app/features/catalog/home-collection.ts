import { signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { CatalogApi } from './catalog.api';
import type { CatalogMeta, ProductSummary } from './catalog.types';
import { errorMessage } from '@web/core/api-error';
export class HomeCollection {
  readonly products = signal<ProductSummary[]>([]);
  readonly meta = signal<CatalogMeta | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  private version = 0;
  private lastReset = true;
  constructor(
    private readonly api: CatalogApi,
    readonly key: string,
    readonly title: string,
    readonly caption: string,
    readonly query: Record<string, string | number | boolean>,
  ) {}
  async load(reset = true): Promise<void> {
    if (!reset && (this.loading() || !this.meta()?.hasNext)) return;
    this.lastReset = reset;
    const version = ++this.version;
    this.loading.set(true);
    this.error.set('');
    try {
      const page = reset ? 1 : (this.meta()?.page ?? 0) + 1;
      const response = await firstValueFrom(
        this.api.products({ ...this.query, page, limit: 8, includeFacets: false }),
      );
      if (version !== this.version) return;
      const old = reset ? [] : this.products();
      const seen = new Set(old.map((p) => p.id));
      this.products.set([...old, ...response.data.filter((p) => !seen.has(p.id))]);
      this.meta.set(response.meta);
    } catch (error) {
      if (version === this.version)
        this.error.set(errorMessage(error, 'This collection could not load. Try again.'));
    } finally {
      if (version === this.version) this.loading.set(false);
    }
  }
  retry() {
    return this.load(this.lastReset);
  }
}
