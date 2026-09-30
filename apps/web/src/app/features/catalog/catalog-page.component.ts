import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import type { ElementRef, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, firstValueFrom } from 'rxjs';
import { SettingsStore } from '@web/core/settings-store';
import { CatalogApi } from '@web/features/catalog/catalog.api';
import type {
  CatalogMeta,
  CategoryView,
  ProductSummary,
} from '@web/features/catalog/catalog.types';
import { ProductCardComponent } from '@web/features/catalog/product-card.component';
import { errorMessage } from '@web/core/api-error';

const emptyMeta: CatalogMeta = {
  page: 1,
  limit: 12,
  total: 0,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,
};

@Component({
  selector: 'app-catalog-page',
  imports: [RouterLink, ReactiveFormsModule, ProductCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page-container catalogue">
      <nav class="catalogue__breadcrumbs" aria-label="Breadcrumb">
        <a routerLink="/">Home</a> / <a routerLink="/shop">Shop</a>
        @if (category()) {
          / {{ category()?.name }}
        }
      </nav>
      <header class="catalogue__heading">
        <div>
          <span class="eyebrow">The collection</span>
          <h1>{{ heading() }}</h1>
          @if (category()?.description) {
            <p class="muted">{{ category()?.description }}</p>
          }
        </div>
        <p class="muted">{{ meta().total }} {{ meta().total === 1 ? 'product' : 'products' }}</p>
      </header>
      <div class="catalogue__toolbar">
        <button
          #filtersButton
          type="button"
          class="catalogue__filter-button"
          (click)="openFilters()"
        >
          Filters
        </button>
        <label
          >Sort by
          <select [formControl]="sortControl" (change)="changeSort()">
            @if (query()['q']) {
              <option value="relevance">Relevance</option>
            }
            <option value="-createdAt">Newest</option>
            <option value="price">Price: low to high</option>
            <option value="-price">Price: high to low</option>
            <option value="-soldCount">Best selling</option>
            <option value="-ratingAverage">Top rated</option>
            <option value="name">Name: A–Z</option>
          </select>
        </label>
      </div>
      @if (chips().length) {
        <div class="catalogue__chips" aria-label="Active filters">
          @for (chip of chips(); track chip.key) {
            <button type="button" (click)="removeFilter(chip.key)">{{ chip.label }} ×</button>
          }
          <button type="button" (click)="clearFilters()">Clear all</button>
        </div>
      }
      <div class="catalogue__body">
        @if (filtersOpen()) {
          <button
            type="button"
            class="catalogue__backdrop"
            aria-label="Close filters"
            (click)="closeFilters()"
          ></button>
        }
        <aside
          #filterPanel
          class="catalogue__filters"
          [class.catalogue__filters--open]="filtersOpen()"
          [attr.role]="filtersOpen() ? 'dialog' : null"
          [attr.aria-modal]="filtersOpen() ? 'true' : null"
          aria-label="Product filters"
          (keydown)="filterKey($event)"
        >
          <div class="catalogue__filters-title">
            <h2>Filters</h2>
            <button type="button" class="catalogue__close" (click)="closeFilters()">Close</button>
          </div>
          <h3>Categories</h3>
          <nav class="catalogue__category-links" aria-label="Browse categories">
            <a routerLink="/shop" (click)="closeFilters()">All products</a>
            @for (item of categories(); track item.id) {
              <a [routerLink]="['/shop', item.slug]" (click)="closeFilters()"
                >{{ item.name }} <span>{{ item.productCount }}</span></a
              >
            }
          </nav>
          <form [formGroup]="filters" (ngSubmit)="applyFilters()">
            <fieldset>
              <legend>Price</legend>
              <div class="catalogue__price-fields">
                <label>Min <input type="number" min="0" formControlName="minPrice" /></label>
                <label>Max <input type="number" min="0" formControlName="maxPrice" /></label>
              </div>
            </fieldset>
            <fieldset>
              <legend>Availability</legend>
              <label class="catalogue__checkbox"
                ><input type="checkbox" formControlName="inStock" /> In stock only</label
              >
            </fieldset>
            <fieldset>
              <legend>Minimum rating</legend>
              <select formControlName="rating">
                <option value="">Any rating</option>
                <option value="4">4 stars and up</option>
                <option value="4.5">4.5 stars and up</option>
              </select>
            </fieldset>
            <fieldset>
              <legend>Color</legend>
              <select formControlName="color">
                <option value="">All colors</option>
                @for (option of meta().facets?.options?.['Color'] ?? []; track option.value) {
                  <option [value]="option.value">{{ option.value }} ({{ option.count }})</option>
                }
              </select>
            </fieldset>
            @if (filterError()) {
              <p role="alert" class="catalogue__filter-error">{{ filterError() }}</p>
            }
            <button type="submit">Apply filters</button>
          </form>
        </aside>
        <section class="catalogue__results" aria-label="Products">
          @if (loading()) {
            <div class="catalogue__grid" aria-label="Loading products">
              @for (item of [1, 2, 3, 4, 5, 6]; track item) {
                <div class="catalogue__skeleton skeleton"></div>
              }
            </div>
          } @else if (error()) {
            <div class="catalogue__state" role="alert">
              <h2>Products could not load</h2>
              <p>{{ error() }}</p>
              <button type="button" (click)="load()">Retry</button>
            </div>
          } @else if (products().length === 0) {
            <div class="catalogue__state">
              <h2>No matching products</h2>
              <p>Try a wider price range or remove a filter.</p>
              <button type="button" (click)="clearFilters()">Clear filters</button>
            </div>
          } @else {
            <div class="catalogue__grid">
              @for (item of products(); track item.id; let i = $index) {
                <app-product-card
                  [product]="item"
                  [priority]="i === 0"
                  [price]="settings.formatMoney(item.priceFrom)"
                  [comparePrice]="
                    item.compareAtFrom === null ? null : settings.formatMoney(item.compareAtFrom)
                  "
                />
              }
            </div>
            <nav class="catalogue__pagination" aria-label="Product pages">
              <button type="button" [disabled]="!meta().hasPrev" (click)="goPage(meta().page - 1)">
                Previous
              </button>
              <span>Page {{ meta().page }} of {{ meta().totalPages }}</span>
              <button type="button" [disabled]="!meta().hasNext" (click)="goPage(meta().page + 1)">
                Next
              </button>
              <label
                >Per page
                <select [formControl]="limitControl" (change)="changeLimit()">
                  <option value="12">12</option>
                  <option value="24">24</option>
                  <option value="48">48</option>
                </select></label
              >
            </nav>
          }
        </section>
      </div>
    </main>
  `,
  styles: [
    `
      .catalogue__breadcrumbs {
        font-size: 0.82rem;
        color: var(--color-muted);
        margin-bottom: 2rem;
      }
      .catalogue__heading {
        display: flex;
        justify-content: space-between;
        align-items: end;
        gap: 1rem;
      }
      .catalogue__heading h1 {
        margin: 0.4rem 0;
      }
      .catalogue__toolbar {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 1rem;
        margin: 2rem 0 1rem;
      }
      .catalogue__toolbar label,
      .catalogue__pagination label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.85rem;
      }
      .catalogue__body {
        display: grid;
        grid-template-columns: 15rem minmax(0, 1fr);
        gap: 2rem;
      }
      .catalogue__filters {
        align-self: start;
        position: sticky;
        top: 6rem;
      }
      .catalogue__filters-title {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .catalogue__filters h2 {
        font-size: 1.1rem;
      }
      .catalogue__filters h3 {
        font-size: 0.9rem;
        margin-top: 1.5rem;
      }
      .catalogue__filters form {
        display: grid;
        gap: 1rem;
      }
      .catalogue__filters fieldset {
        border: 0;
        padding: 0;
        margin: 0.5rem 0;
      }
      .catalogue__filters legend {
        font-weight: 650;
        margin-bottom: 0.7rem;
      }
      .catalogue__filters label {
        font-size: 0.8rem;
      }
      .catalogue__filters input,
      .catalogue__filters select {
        width: 100%;
      }
      .catalogue__filter-error {
        color: var(--color-danger);
        font-size: 0.85rem;
      }
      .catalogue__price-fields {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.5rem;
      }
      .catalogue__checkbox {
        display: flex;
        align-items: center;
        gap: 0.6rem;
      }
      .catalogue__checkbox input {
        width: auto;
      }
      .catalogue__category-links {
        display: grid;
        gap: 0.7rem;
        font-size: 0.83rem;
      }
      .catalogue__category-links a {
        display: flex;
        justify-content: space-between;
      }
      .catalogue__grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 1.2rem;
      }
      .catalogue__skeleton {
        aspect-ratio: 5 / 4;
      }
      .catalogue__chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
        margin-bottom: 1rem;
      }
      .catalogue__chips button {
        background: var(--color-surface);
        color: var(--color-ink);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-pill);
        font-size: 0.78rem;
        min-height: 34px;
      }
      .catalogue__pagination {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        margin: 3rem 0;
      }
      .catalogue__state {
        text-align: center;
        padding: 5rem 1rem;
        background: var(--color-surface);
        border-radius: var(--radius-card);
      }
      .catalogue__filter-button,
      .catalogue__close,
      .catalogue__backdrop {
        display: none;
      }
      @media (max-width: 1024px) {
        .catalogue__grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      @media (max-width: 768px) {
        .catalogue__body {
          display: block;
        }
        .catalogue__filter-button,
        .catalogue__close {
          display: inline-flex;
        }
        .catalogue__filters {
          display: none;
          position: fixed;
          z-index: 31;
          top: auto;
          bottom: 0;
          left: 0;
          right: 0;
          max-height: 80vh;
          overflow: auto;
          padding: 1.25rem;
          background: var(--color-surface);
          border-radius: 16px 16px 0 0;
          box-shadow: var(--shadow-raised);
        }
        .catalogue__filters--open {
          display: block;
        }
        .catalogue__backdrop {
          display: block;
          position: fixed;
          z-index: 30;
          inset: 0;
          border: 0;
          border-radius: 0;
          background: var(--color-backdrop);
        }
      }
      @media (max-width: 480px) {
        .catalogue__grid {
          grid-template-columns: 1fr 1fr;
          gap: 0.7rem;
        }
        .catalogue__heading {
          display: block;
        }
      }
    `,
  ],
})
export class CatalogPageComponent implements OnInit {
  readonly settings = inject(SettingsStore);
  private readonly api = inject(CatalogApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly destroyRef = inject(DestroyRef);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly filtersOpen = signal(false);
  readonly filterError = signal('');
  readonly filterPanel = viewChild<ElementRef<HTMLElement>>('filterPanel');
  readonly filtersButton = viewChild<ElementRef<HTMLButtonElement>>('filtersButton');
  private requestId = 0;
  readonly products = signal<ProductSummary[]>([]);
  readonly meta = signal<CatalogMeta>(emptyMeta);
  readonly category = signal<CategoryView | null>(null);
  readonly categories = signal<CategoryView[]>([]);
  readonly query = signal<Record<string, string>>({});
  readonly sortControl = new FormControl('-createdAt', { nonNullable: true });
  readonly limitControl = new FormControl('12', { nonNullable: true });
  readonly filters = new FormGroup({
    minPrice: new FormControl('', { nonNullable: true }),
    maxPrice: new FormControl('', { nonNullable: true }),
    inStock: new FormControl(false, { nonNullable: true }),
    rating: new FormControl('', { nonNullable: true }),
    color: new FormControl('', { nonNullable: true }),
  });

  ngOnInit(): void {
    void firstValueFrom(this.api.categories())
      .then((response) => this.categories.set(response.data))
      .catch(() => this.categories.set([]));
    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([params, queries]) => {
        const query: Record<string, string> = {};
        for (const key of queries.keys) query[key] = queries.get(key) ?? '';
        this.query.set(query);
        this.sortControl.setValue(query['sort'] ?? (query['q'] ? 'relevance' : '-createdAt'), {
          emitEvent: false,
        });
        this.limitControl.setValue(query['limit'] ?? '12', { emitEvent: false });
        this.filters.setValue(
          {
            minPrice: query['minPrice'] ? String(Number(query['minPrice']) / 100) : '',
            maxPrice: query['maxPrice'] ? String(Number(query['maxPrice']) / 100) : '',
            inStock: query['inStock'] === 'true',
            rating: query['rating'] ?? '',
            color: query['options[Color]'] ?? '',
          },
          { emitEvent: false },
        );
        void this.load(params.get('categorySlug') ?? undefined);
      });
  }

  heading(): string {
    if (this.query()['q']) return `Search results for “${this.query()['q']}”`;
    return this.category()?.name ?? 'Shop all products';
  }
  chips(): { key: string; label: string }[] {
    const labels: Record<string, string> = {
      minPrice: 'Min price',
      maxPrice: 'Max price',
      inStock: 'In stock',
      rating: 'Rating',
      'options[Color]': 'Color',
    };
    return Object.entries(this.query())
      .filter(([key]) => key in labels)
      .map(([key, value]) => ({ key, label: `${labels[key]}: ${value}` }));
  }

  async load(
    categorySlug = this.route.snapshot.paramMap.get('categorySlug') ?? undefined,
  ): Promise<void> {
    const requestId = ++this.requestId;
    this.loading.set(true);
    this.error.set('');
    try {
      const query = {
        ...this.query(),
        ...(categorySlug ? { category: categorySlug } : {}),
        includeFacets: true,
      };
      const [products, category] = await Promise.all([
        firstValueFrom(this.api.products(query)),
        categorySlug
          ? firstValueFrom(this.api.category(categorySlug)).then((response) => response.data)
          : Promise.resolve(null),
      ]);
      if (requestId !== this.requestId) return;
      this.products.set(products.data);
      this.meta.set(products.meta);
      this.category.set(category);
      this.title.setTitle(`${this.heading()} | ${this.settings.data()?.store.name ?? 'Store'}`);
    } catch (error) {
      if (requestId === this.requestId)
        this.error.set(errorMessage(error, 'Check your connection and try again.'));
    } finally {
      if (requestId === this.requestId) this.loading.set(false);
    }
  }

  openFilters(): void {
    this.filtersOpen.set(true);
    setTimeout(
      () =>
        this.filterPanel()
          ?.nativeElement.querySelector<HTMLElement>('button, a, input, select')
          ?.focus(),
      0,
    );
  }
  closeFilters(): void {
    this.filtersOpen.set(false);
    this.filtersButton()?.nativeElement.focus();
  }
  filterKey(event: KeyboardEvent): void {
    if (!this.filtersOpen()) return;
    if (event.key === 'Escape') {
      this.closeFilters();
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = Array.from(
      this.filterPanel()?.nativeElement.querySelectorAll<HTMLElement>('button, a, input, select') ??
        [],
    ).filter((element) => !element.hasAttribute('disabled'));
    const first = controls[0];
    const last = controls.at(-1);
    if (!first || !last) return;
    const active = this.filterPanel()?.nativeElement.ownerDocument.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private navigate(query: Record<string, string | null>): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: query });
  }
  applyFilters(): void {
    const value = this.filters.getRawValue();
    const min = value.minPrice ? Number(value.minPrice) : 0;
    const max = value.maxPrice ? Number(value.maxPrice) : Infinity;
    if (!Number.isFinite(min) || min < 0 || Number.isNaN(max) || max < 0 || min > max) {
      this.filterError.set('Enter a valid price range with a minimum no greater than the maximum.');
      return;
    }
    this.filterError.set('');
    this.navigate({
      ...this.query(),
      page: '1',
      minPrice: value.minPrice ? String(Math.round(Number(value.minPrice) * 100)) : null,
      maxPrice: value.maxPrice ? String(Math.round(Number(value.maxPrice) * 100)) : null,
      inStock: value.inStock ? 'true' : null,
      rating: value.rating || null,
      'options[Color]': value.color || null,
    });
    this.closeFilters();
  }
  removeFilter(key: string): void {
    const query = { ...this.query() };
    delete query[key];
    query['page'] = '1';
    this.navigate(query);
  }
  clearFilters(): void {
    const q = this.query()['q'];
    this.navigate(q ? { q, sort: 'relevance' } : {});
    this.filtersOpen.set(false);
  }
  changeSort(): void {
    this.navigate({ ...this.query(), sort: this.sortControl.value, page: '1' });
  }
  changeLimit(): void {
    this.navigate({ ...this.query(), limit: this.limitControl.value, page: '1' });
  }
  goPage(page: number): void {
    this.navigate({ ...this.query(), page: String(page) });
  }
}
