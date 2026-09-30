import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { ApiEnvelope } from '@commerceos/shared';
import type {
  CatalogMeta,
  CategoryView,
  ProductDetail,
  ProductSummary,
  StoreSettings,
} from '@web/features/catalog/catalog.types';

@Injectable({ providedIn: 'root' })
export class CatalogApi {
  private readonly http = inject(HttpClient);
  settings() {
    return this.http.get<ApiEnvelope<StoreSettings>>('/api/v1/settings/public');
  }
  categories() {
    return this.http.get<ApiEnvelope<CategoryView[]>>('/api/v1/categories');
  }
  category(slug: string) {
    return this.http.get<ApiEnvelope<CategoryView>>(
      `/api/v1/categories/${encodeURIComponent(slug)}`,
    );
  }
  products(query: Record<string, string | number | boolean | undefined>) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query))
      if (value !== undefined && value !== '') params = params.set(key, String(value));
    return this.http.get<{ data: ProductSummary[]; meta: CatalogMeta }>('/api/v1/products', {
      params,
    });
  }
  product(slug: string) {
    return this.http.get<ApiEnvelope<ProductDetail>>(
      `/api/v1/products/${encodeURIComponent(slug)}`,
    );
  }
  related(slug: string) {
    return this.http.get<ApiEnvelope<ProductSummary[]>>(
      `/api/v1/products/${encodeURIComponent(slug)}/related`,
    );
  }
  suggest(q: string) {
    return this.http.get<
      ApiEnvelope<{ type: 'product' | 'category'; name: string; slug: string }[]>
    >('/api/v1/products/suggest', { params: { q } });
  }
}
