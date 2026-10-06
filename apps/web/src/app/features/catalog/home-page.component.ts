import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import type { OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SettingsStore } from '@web/core/settings-store';
import { CatalogApi } from '@web/features/catalog/catalog.api';
import type { CategoryView, ProductSummary } from '@web/features/catalog/catalog.types';
import { ProductCardComponent } from '@web/features/catalog/product-card.component';
import { errorMessage } from '@web/core/api-error';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink, ProductCardComponent, NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main>
      @if (loading()) {
        <div class="home__hero skeleton" aria-label="Loading featured products"></div>
        <div class="page-container home__grid">
          @for (item of [1, 2, 3, 4]; track item) {
            <div class="home__card-skeleton skeleton"></div>
          }
        </div>
      } @else if (error()) {
        <section class="page-container home__state" role="alert">
          <h1>We could not load the store</h1>
          <p>{{ error() }}</p>
          <button type="button" (click)="load()">Retry</button>
        </section>
      } @else {
        <section class="home__hero">
          <div class="home__hero-copy">
            <span class="eyebrow">For the way you live</span>
            <h1>{{ settings.data()?.store?.tagline }}</h1>
            <p>
              Thoughtful design. Everyday utility. Discover electronics that earn their place in
              your life.
            </p>
            <a class="home__hero-link" routerLink="/shop"
              >Explore the collection <span aria-hidden="true">→</span></a
            >
          </div>
          @if (featured()[0]?.primaryImage; as image) {
            <a [routerLink]="['/products', featured()[0]?.slug]" class="home__hero-image"
              ><img [ngSrc]="image.url" [alt]="image.alt" width="1000" height="800" priority /><span
                class="home__spotlight"
                ><span
                  ><small>In the spotlight</small><strong>{{ featured()[0]?.name }}</strong></span
                ><span
                  >{{ settings.formatMoney(featured()[0]?.priceFrom ?? 0) }}
                  <span aria-hidden="true">↗</span></span
                ></span
              ></a
            >
          }
        </section>
        <div class="page-container">
          <section class="home__section" aria-labelledby="featured-title">
            <div class="home__section-heading">
              <div>
                <span class="eyebrow">Selected pieces</span>
                <h2 id="featured-title">The considered selection.</h2>
              </div>
              <a routerLink="/shop">View all products →</a>
            </div>
            @if (featured().length) {
              <div class="home__grid">
                @for (item of featured(); track item.id) {
                  <app-product-card
                    [product]="item"
                    [price]="settings.formatMoney(item.priceFrom)"
                    [comparePrice]="
                      item.compareAtFrom === null ? null : settings.formatMoney(item.compareAtFrom)
                    "
                  />
                }
              </div>
            } @else {
              <p class="muted">
                No featured pieces are available right now.
                <a routerLink="/shop">Browse all products</a>.
              </p>
            }
          </section>
          <section class="home__section" aria-labelledby="categories-title">
            <div class="home__section-heading">
              <div>
                <span class="eyebrow">Find your space</span>
                <h2 id="categories-title">Shop by category</h2>
              </div>
            </div>
            @if (categories().length) {
              <div class="home__category-grid">
                @for (category of categories(); track category.id) {
                  <a class="home__category" [routerLink]="['/shop', category.slug]">
                    @if (category.image) {
                      <img
                        [ngSrc]="category.image"
                        [alt]="category.name"
                        width="600"
                        height="480"
                        loading="lazy"
                      />
                    }
                    <span
                      ><strong>{{ category.name }}</strong
                      ><small>{{ category.productCount }} products</small></span
                    >
                  </a>
                }
              </div>
            } @else {
              <p class="muted">
                Categories are being prepared. Browse <a routerLink="/shop">all products</a>.
              </p>
            }
          </section>
          <section class="home__section" aria-labelledby="new-title">
            <div class="home__section-heading">
              <div>
                <span class="eyebrow">Just arrived</span>
                <h2 id="new-title">New arrivals</h2>
              </div>
            </div>
            <div class="home__grid">
              @for (item of arrivals(); track item.id) {
                <app-product-card
                  [product]="item"
                  [price]="settings.formatMoney(item.priceFrom)"
                  [comparePrice]="
                    item.compareAtFrom === null ? null : settings.formatMoney(item.compareAtFrom)
                  "
                />
              }
            </div>
          </section>
          <section class="home__section" aria-labelledby="best-title">
            <div class="home__section-heading">
              <div>
                <span class="eyebrow">Customer favourites</span>
                <h2 id="best-title">Best sellers</h2>
              </div>
            </div>
            <div class="home__grid">
              @for (item of bestSellers(); track item.id) {
                <app-product-card
                  [product]="item"
                  [price]="settings.formatMoney(item.priceFrom)"
                  [comparePrice]="
                    item.compareAtFrom === null ? null : settings.formatMoney(item.compareAtFrom)
                  "
                />
              }
            </div>
          </section>
          <section class="home__values" aria-label="Store benefits">
            @for (value of settings.data()?.store?.valueProps ?? []; track value.title) {
              <div>
                <strong>{{ value.title }}</strong>
                <p>{{ value.text }}</p>
              </div>
            }
          </section>
        </div>
      }
    </main>
  `,
  styleUrl: './home-page.component.scss',
})
export class HomePageComponent implements OnInit {
  readonly settings = inject(SettingsStore);
  private readonly api = inject(CatalogApi);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly featured = signal<ProductSummary[]>([]);
  readonly arrivals = signal<ProductSummary[]>([]);
  readonly bestSellers = signal<ProductSummary[]>([]);
  readonly categories = signal<CategoryView[]>([]);
  ngOnInit(): void {
    void this.load();
  }
  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const [featured, arrivals, best, categories] = await Promise.all([
        firstValueFrom(this.api.products({ featured: true, limit: 4 })),
        firstValueFrom(this.api.products({ sort: '-createdAt', limit: 4 })),
        firstValueFrom(this.api.products({ sort: '-soldCount', limit: 4 })),
        firstValueFrom(this.api.categories()),
      ]);
      this.featured.set(featured.data);
      this.arrivals.set(arrivals.data);
      this.bestSellers.set(best.data);
      this.categories.set(categories.data);
    } catch (error) {
      this.error.set(errorMessage(error, 'Check your connection and try again.'));
    } finally {
      this.loading.set(false);
    }
  }
}
