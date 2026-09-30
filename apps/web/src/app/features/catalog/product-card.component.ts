import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { WishlistStore } from './wishlist-store';
import { SettingsStore } from '@web/core/settings-store';
import { RouterLink } from '@angular/router';
import type { ProductSummary } from '@web/features/catalog/catalog.types';

@Component({
  selector: 'app-product-card',
  imports: [RouterLink, NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="product-card">
      <a [routerLink]="['/products', product().slug]" class="product-card__image-link">
        @if (product().primaryImage; as image) {
          <img
            [ngSrc]="image.url"
            [alt]="image.alt"
            [priority]="priority()"
            [loading]="priority() ? 'eager' : 'lazy'"
            width="600"
            height="480"
          />
        } @else {
          <span class="product-card__image-empty">Image unavailable</span>
        }
        @if (!product().inStock) {
          <span class="product-card__badge">Out of stock</span>
        }
      </a>
      <div class="product-card__info">
        @if (settings.data()?.features?.wishlist) {
          <button
            class="heart"
            [disabled]="wishlist.busy()"
            [attr.aria-pressed]="wishlist.ids().includes(product().id)"
            [attr.aria-label]="'Save ' + product().name + ' to wishlist'"
            (click)="wishlist.toggle(product().id)"
          >
            {{ wishlist.ids().includes(product().id) ? '♥' : '♡' }}
          </button>
        }
        <span class="product-card__category">{{ product().category.name }}</span>
        <h3>
          <a [routerLink]="['/products', product().slug]">{{ product().name }}</a>
        </h3>
        <div class="product-card__price">
          <strong>{{ price() }}</strong>
          @if (comparePrice(); as compare) {
            <del>{{ compare }}</del>
          }
        </div>
        <p class="product-card__rating">
          {{ product().ratingAverage.toFixed(1) }} / 5 · {{ product().ratingCount }} reviews
        </p>
      </div>
    </article>
  `,
  styles: [
    `
      .product-card {
        min-width: 0;
      }
      .product-card__image-link {
        position: relative;
        display: block;
        overflow: hidden;
        border-radius: var(--radius-card);
        background: var(--color-border);
        aspect-ratio: 5 / 4;
      }
      .product-card__image-link img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 220ms ease-out;
      }
      .product-card:hover img {
        transform: scale(1.035);
      }
      .product-card__image-empty {
        display: grid;
        place-items: center;
        height: 100%;
        color: var(--color-muted);
      }
      .product-card__badge {
        position: absolute;
        left: 0.75rem;
        top: 0.75rem;
        background: var(--color-surface);
        padding: 0.35rem 0.6rem;
        border-radius: var(--radius-pill);
        font-size: 0.75rem;
      }
      .product-card__info {
        padding: 0.9rem 0.1rem;
        position: relative;
        padding-right: 2.75rem;
      }
      .heart {
        position: absolute;
        right: 0;
        top: 0.5rem;
        background: var(--color-surface);
        color: var(--color-ink);
        border: 0;
        font-size: 1.4rem;
        padding: 0.3rem 0.6rem;
      }
      .product-card__category {
        color: var(--color-muted);
        text-transform: uppercase;
        font-size: 0.72rem;
        letter-spacing: 0.11em;
      }
      .product-card h3 {
        margin: 0.4rem 0 0.65rem;
        font-size: 1.05rem;
        letter-spacing: -0.02em;
      }
      .product-card__price {
        display: flex;
        gap: 0.7rem;
        align-items: center;
      }
      .product-card__price del,
      .product-card__rating {
        color: var(--color-muted);
        font-size: 0.8rem;
      }
      .product-card__rating {
        margin: 0.35rem 0 0;
      }
    `,
  ],
})
export class ProductCardComponent {
  readonly wishlist = inject(WishlistStore);
  readonly settings = inject(SettingsStore);
  readonly product = input.required<ProductSummary>();
  readonly price = input.required<string>();
  readonly comparePrice = input<string | null>(null);
  readonly priority = input(false);
}
