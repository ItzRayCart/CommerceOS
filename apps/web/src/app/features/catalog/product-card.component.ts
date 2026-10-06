import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { IconComponent } from '@web/shared/icon.component';
import { WishlistStore } from './wishlist-store';
import { SettingsStore } from '@web/core/settings-store';
import { RouterLink } from '@angular/router';
import type { ProductSummary } from '@web/features/catalog/catalog.types';

@Component({
  selector: 'app-product-card',
  imports: [RouterLink, NgOptimizedImage, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="product-card">
      <a [routerLink]="['/products', product().slug]" class="product-card__image-link">
        @if (product().primaryImage; as image) {
          <img
            [ngSrc]="image.url"
            [alt]="image.alt"
            [priority]="priority()"
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
            <app-icon name="heart" />
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
        @if (settings.data()?.features?.reviews) {
          <p class="product-card__rating">
            {{ product().ratingAverage.toFixed(1) }} / 5 · {{ product().ratingCount }} reviews
          </p>
        }
      </div>
    </article>
  `,
  styleUrl: './product-card.component.scss',
})
export class ProductCardComponent {
  readonly wishlist = inject(WishlistStore);
  readonly settings = inject(SettingsStore);
  readonly product = input.required<ProductSummary>();
  readonly price = input.required<string>();
  readonly comparePrice = input<string | null>(null);
  readonly priority = input(false);
}
