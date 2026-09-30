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
            <span class="eyebrow">New perspective on the everyday</span>
            <h1>{{ settings.data()?.store?.tagline }}</h1>
            <p>Explore purposeful technology chosen for the way you live and work.</p>
            <a class="home__hero-link" routerLink="/shop"
              >Explore the collection <span aria-hidden="true">↗</span></a
            >
          </div>
          @if (featured()[0]?.primaryImage; as image) {
            <a [routerLink]="['/products', featured()[0]?.slug]" class="home__hero-image"
              ><img [ngSrc]="image.url" [alt]="image.alt" width="1000" height="800" priority
            /></a>
          }
        </section>
        <div class="page-container">
          <section class="home__section" aria-labelledby="featured-title">
            <div class="home__section-heading">
              <div>
                <span class="eyebrow">Selected pieces</span>
                <h2 id="featured-title">Featured</h2>
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
  styles: [
    `
      .home__hero {
        max-width: 88rem;
        margin: 1.25rem auto 0;
        min-height: 31rem;
        background: var(--color-ink);
        color: var(--color-surface);
        display: grid;
        grid-template-columns: 1fr 1fr;
        overflow: hidden;
        border-radius: var(--radius-card);
      }
      .home__hero-copy {
        padding: clamp(2rem, 5vw, 5rem);
        align-self: center;
      }
      .home__hero-copy h1 {
        max-width: 12ch;
        font-size: clamp(2.5rem, 5vw, 5rem);
        margin: 1rem 0;
      }
      .home__hero-copy p {
        color: var(--color-on-dark-muted);
        max-width: 35ch;
      }
      .home__hero-link {
        display: inline-flex;
        align-items: center;
        gap: 1.2rem;
        margin-top: 1.4rem;
        padding: 0.8rem 1.1rem;
        border: 1px solid var(--color-surface);
        border-radius: var(--radius-button);
      }
      .home__hero-image img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .home__section {
        margin: 4.5rem 0;
      }
      .home__section-heading {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1.5rem;
      }
      .home__section-heading h2 {
        margin: 0.35rem 0 0;
      }
      .home__section-heading a {
        font-size: 0.9rem;
      }
      .home__grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 1.25rem;
      }
      .home__card-skeleton {
        aspect-ratio: 5 / 4;
      }
      .home__category-grid {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 1rem;
      }
      .home__category {
        position: relative;
        overflow: hidden;
        border-radius: var(--radius-card);
        background: var(--color-border);
      }
      .home__category img {
        width: 100%;
        height: 16rem;
        object-fit: cover;
        display: block;
      }
      .home__category span {
        display: grid;
        padding: 1rem;
        background: var(--color-surface);
      }
      .home__category small {
        color: var(--color-muted);
        margin-top: 0.25rem;
      }
      .home__values {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 2rem;
        border-top: 1px solid var(--color-border);
        padding: 2rem 0;
      }
      .home__values p {
        color: var(--color-muted);
      }
      .home__state {
        min-height: 50vh;
      }
      @media (max-width: 1024px) {
        .home__grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .home__category-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }
      @media (max-width: 680px) {
        .home__hero {
          margin: 0.75rem;
          grid-template-columns: 1fr;
        }
        .home__hero-image {
          max-height: 16rem;
        }
        .home__category-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .home__values {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
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
