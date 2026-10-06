import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { AuthStore } from '@web/core/auth-session';
import { SettingsStore } from '@web/core/settings-store';
import { CartStore } from './cart.store';

@Component({
  selector: 'app-cart-page',
  imports: [RouterLink, NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<main class="page-container">
    <p class="eyebrow">Your selection</p>
    <h1>Shopping cart</h1>
    @if (cart.loading()) {
      <p role="status">Refreshing prices and stock…</p>
    }
    @if (cart.error()) {
      <p role="alert">
        {{ cart.error() }}
        <button (click)="cart.pendingMerge() ? cart.retryMerge() : cart.load()">Retry</button>
      </p>
    }
    @if (cart.quote().discountError; as discountError) {
      <p role="alert">{{ discountError.message }}</p>
    }
    <p role="status">{{ cart.notice() }}</p>
    @if (cart.quote().lines.length) {
      <div class="layout">
        <section class="items" aria-label="Cart items">
          @for (line of cart.quote().lines; track line.id) {
            <article class="item">
              @if (line.slug && line.image) {
                <a [routerLink]="['/products', line.slug]"
                  ><img [ngSrc]="line.image" [alt]="line.name" width="160" height="128"
                /></a>
              } @else {
                <span class="item-placeholder">Unavailable</span>
              }
              <div class="item-copy">
                <h2>
                  @if (line.slug) {
                    <a [routerLink]="['/products', line.slug]">{{ line.name }}</a>
                  } @else {
                    {{ line.name }}
                  }
                </h2>
                <p class="muted">{{ line.variantLabel }} · {{ line.sku }}</p>
                @if (line.unavailable) {
                  <p class="warning" role="alert">
                    {{
                      line.available
                        ? 'Only ' + line.available + ' available. Reduce your quantity.'
                        : 'Unavailable. Remove this item.'
                    }}
                  </p>
                }
                @if (line.priceChanged) {
                  <p class="warning">Price changed. The latest price is shown.</p>
                }
                <button class="text-button" [disabled]="cart.busy()" (click)="cart.remove(line.id)">
                  Remove
                </button>
              </div>
              <div class="controls">
                <strong>{{ settings.formatMoney(line.lineTotal) }}</strong
                ><label
                  >Quantity
                  <input
                    #qty
                    type="number"
                    min="1"
                    [max]="Math.min(10, line.available)"
                    [value]="line.quantity"
                    [disabled]="cart.busy() || line.available === 0"
                    (change)="cart.update(line.id, qty.valueAsNumber)"
                /></label>
              </div>
            </article>
          }
          <button class="text-button" [disabled]="cart.busy()" (click)="clearCart()">
            Clear cart
          </button>
        </section>
        <aside class="summary">
          <h2>Order summary</h2>
          <dl>
            <div>
              <dt>Subtotal</dt>
              <dd>{{ settings.formatMoney(cart.quote().totals.subtotal) }}</dd>
            </div>
            @if (cart.quote().totals.discount) {
              <div>
                <dt>Discount</dt>
                <dd>−{{ settings.formatMoney(cart.quote().totals.discount) }}</dd>
              </div>
            }
            <div>
              <dt>Estimated shipping</dt>
              <dd>{{ settings.formatMoney(cart.quote().totals.shipping) }}</dd>
            </div>
            <div>
              <dt>Estimated tax</dt>
              <dd>{{ settings.formatMoney(cart.quote().totals.tax) }}</dd>
            </div>
            <div class="total">
              <dt>Estimated total</dt>
              <dd>{{ settings.formatMoney(cart.quote().totals.total) }}</dd>
            </div>
          </dl>
          @if (cart.quote().discountCode) {
            <p>
              Code {{ cart.quote().discountCode }}
              <button class="text-button" (click)="cart.removeDiscount()">Remove</button>
            </p>
          } @else {
            <form (submit)="discount($event, code.value)">
              <label for="discount-code">Discount code</label>
              <div class="coupon">
                <input #code id="discount-code" autocomplete="off" /><button
                  [disabled]="cart.busy()"
                >
                  Apply
                </button>
              </div>
            </form>
          }
          @if (!auth.user()) {
            <p>
              Sign in to save your cart and apply a discount.
              <a routerLink="/login" [queryParams]="{ returnUrl: '/cart' }">Sign in</a>
            </p>
          }
          <button
            class="checkout"
            [disabled]="!cart.quote().canCheckout || cart.busy()"
            (click)="checkout()"
          >
            Continue to checkout
          </button>
          <p class="muted">Shipping and tax are estimates until checkout.</p>
        </aside>
      </div>
    } @else if (!cart.loading()) {
      <section class="empty">
        <h2>Your cart is waiting.</h2>
        <p>Find something made for your everyday.</p>
        <a class="button-link" routerLink="/shop">Explore products</a>
      </section>
    }
  </main>`,
  styleUrl: './cart-page.component.scss',
})
export class CartPageComponent {
  readonly cart = inject(CartStore);
  readonly settings = inject(SettingsStore);
  readonly auth = inject(AuthStore);
  readonly Math = Math;
  private readonly title = inject(Title);
  private readonly router = inject(Router);
  checkout() {
    void this.router.navigate(
      this.auth.user() ? ['/checkout'] : ['/login'],
      this.auth.user() ? {} : { queryParams: { returnUrl: '/checkout' } },
    );
  }
  constructor() {
    this.title.setTitle('Shopping cart');
    void this.cart.load();
  }
  discount(event: Event, code: string) {
    event.preventDefault();
    void this.cart.applyDiscount(code);
  }
  clearCart() {
    if (window.confirm('Remove all items from your cart?')) void this.cart.clear();
  }
}
