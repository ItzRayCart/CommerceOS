import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '@web/core/api-error';
import { SettingsStore } from '@web/core/settings-store';
import { CatalogApi } from './catalog.api';
import type { ProductDetail, ProductSummary, ProductVariantView } from './catalog.types';
import { ProductCardComponent } from './product-card.component';
import { CartStore } from '@web/features/cart/cart.store';
import { WishlistStore } from './wishlist-store';

@Component({
  selector: 'app-product-page',
  imports: [RouterLink, ProductCardComponent, NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<main class="page-container">
    @if (loading()) {
      <div class="skeleton loading" aria-label="Loading product"></div>
    } @else if (product(); as item) {
      <nav class="crumb">
        <a routerLink="/shop">Shop</a> /
        <a [routerLink]="['/shop', item.category.slug]">{{ item.category.name }}</a> /
        {{ item.name }}
      </nav>
      <div class="product-layout">
        <section aria-label="Product gallery">
          @if (image(); as photo) {
            <button
              class="hero-image"
              (click)="zoom.showModal()"
              aria-label="Enlarge product image"
            >
              <img [ngSrc]="photo.url" [alt]="photo.alt" width="900" height="720" priority />
            </button>
            <dialog #zoom aria-label="Enlarged product image">
              <button autofocus (click)="zoom.close()">Close image</button
              ><img [ngSrc]="photo.url" [alt]="photo.alt" width="900" height="720" />
            </dialog>
          }
          <div class="thumbnails">
            @for (photo of item.images; track photo.id; let i = $index) {
              <button
                [attr.aria-pressed]="imageIndex() === i"
                (click)="imageIndex.set(i)"
                [attr.aria-label]="'View image ' + (i + 1)"
              >
                <img [ngSrc]="photo.url" [alt]="photo.alt" width="120" height="96" />
              </button>
            }
          </div>
        </section>
        <section class="purchase">
          <p class="eyebrow">{{ item.brand }}</p>
          <h1>{{ item.name }}</h1>
          @if (settings.data()?.features?.reviews) {
            <p class="muted">
              {{ item.ratingAverage.toFixed(1) }} / 5 · {{ item.ratingCount }} reviews
            </p>
          }
          @if (variant(); as selected) {
            <p class="price">
              {{ settings.formatMoney(selected.price) }}
              @if (selected.compareAtPrice) {
                <del>{{ settings.formatMoney(selected.compareAtPrice) }}</del>
              }
            </p>
            @for (option of item.optionDefinitions; track option.name) {
              <fieldset>
                <legend>{{ option.name }}</legend>
                <div class="choices">
                  @for (value of option.values; track value) {
                    <button
                      class="option"
                      [attr.aria-pressed]="selected.options[option.name] === value"
                      [disabled]="!availableOption(option.name, value)"
                      (click)="selectOption(option.name, value)"
                    >
                      {{ value }}
                    </button>
                  }
                </div>
              </fieldset>
            }
            <p class="stock" [class.unavailable]="!selected.stock">
              {{
                selected.stock === 0
                  ? 'Out of stock'
                  : selected.stock <= 5
                    ? 'Only ' + selected.stock + ' left in stock'
                    : 'In stock'
              }}
            </p>
            <p class="muted">SKU {{ selected.sku }}</p>
            <label
              >Quantity <input #quantity type="number" value="1" min="1" [max]="maxQuantity()"
            /></label>
            <button
              class="add"
              [disabled]="!selected.stock || cart.busy()"
              (click)="cart.add(item.id, selected.id, quantity.valueAsNumber)"
            >
              Add to cart
            </button>
            @if (cart.error()) {
              <p role="alert">{{ cart.error() }}</p>
            }
          }
          @if (settings.data()?.features?.wishlist) {
            <button
              class="secondary"
              [disabled]="wishlist.busy()"
              [attr.aria-pressed]="wishlist.ids().includes(item.id)"
              (click)="wishlist.toggle(item.id)"
            >
              {{ wishlist.ids().includes(item.id) ? 'Remove from wishlist' : 'Save to wishlist' }}
            </button>
          }
          @if (notice()) {
            <p role="status">{{ notice() }}</p>
          }
          @if (error()) {
            <p role="alert">{{ error() }}</p>
          }
          <p class="delivery muted">Shipping options and totals are calculated in your cart.</p>
        </section>
      </div>
      <section class="details">
        <h2>Made for the everyday</h2>
        <div class="product-description" [innerHTML]="item.description"></div>
        <h3>Specifications</h3>
        <dl>
          @for (spec of item.specs; track spec.label) {
            <div>
              <dt>{{ spec.label }}</dt>
              <dd>{{ spec.value }}</dd>
            </div>
          }
        </dl>
      </section>
      @if (related().length) {
        <section>
          <h2>You may also like</h2>
          <div class="related">
            @for (other of related(); track other.id) {
              <app-product-card [product]="other" [price]="settings.formatMoney(other.priceFrom)" />
            }
          </div>
        </section>
      }
    } @else {
      <h1>Product unavailable</h1>
      <p role="alert">{{ error() }}</p>
      <button (click)="load()">Try again</button> <a routerLink="/shop">Browse the collection</a>
    }
  </main>`,
  styleUrl: './product-page.component.scss',
})
export class ProductPageComponent {
  private readonly api = inject(CatalogApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  readonly settings = inject(SettingsStore);
  readonly cart = inject(CartStore);
  readonly wishlist = inject(WishlistStore);
  readonly product = signal<ProductDetail | null>(null);
  readonly related = signal<ProductSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly notice = signal('');
  readonly busy = signal(false);
  readonly sku = signal('');
  readonly imageIndex = signal(0);
  readonly variant = computed(
    () =>
      this.product()?.variants.find((v) => v.sku === this.sku()) ??
      this.product()?.variants.find((v) => v.stock > 0) ??
      this.product()?.variants[0],
  );
  readonly image = computed(() => {
    const item = this.product();
    const variantImage = this.variant()?.images[this.imageIndex()];
    return (
      item?.images.find((image) => image.url === variantImage) ??
      item?.images[this.imageIndex()] ??
      item?.images[0]
    );
  });
  readonly maxQuantity = computed(() => Math.min(10, this.variant()?.stock ?? 0));
  private requestId = 0;
  constructor() {
    this.route.paramMap
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => void this.load());
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((params) => this.sku.set(params.get('variant') ?? ''));
  }
  async load() {
    const id = ++this.requestId;
    this.loading.set(true);
    this.error.set('');
    this.notice.set('');
    this.imageIndex.set(0);
    try {
      const slug = this.route.snapshot.paramMap.get('slug') ?? '';
      const result = await firstValueFrom(this.api.product(slug));
      if (id !== this.requestId) return;
      this.product.set(result.data);
      this.title.setTitle(result.data.seo.metaTitle ?? result.data.name);
      this.meta.updateTag({
        name: 'description',
        content: result.data.seo.metaDescription ?? result.data.description,
      });
      void firstValueFrom(this.api.related(slug))
        .then((related) => {
          if (id === this.requestId) this.related.set(related.data.slice(0, 4));
        })
        .catch(() => {
          if (id === this.requestId) this.related.set([]);
        });
    } catch (error) {
      if (id === this.requestId) {
        this.product.set(null);
        this.error.set(errorMessage(error));
      }
    } finally {
      if (id === this.requestId) this.loading.set(false);
    }
  }
  availableOption(name: string, value: string): ProductVariantView | undefined {
    return this.product()?.variants.find(
      (v) =>
        v.stock > 0 &&
        v.options[name] === value &&
        Object.entries(this.variant()?.options ?? {}).every(
          ([key, selected]) => key === name || v.options[key] === selected,
        ),
    );
  }
  selectOption(name: string, value: string) {
    const variant = this.availableOption(name, value);
    if (variant) {
      this.imageIndex.set(0);
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { variant: variant.sku },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }
}
