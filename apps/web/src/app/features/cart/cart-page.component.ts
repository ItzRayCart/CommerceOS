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
  styles: [
    `
      .layout {
        display: grid;
        grid-template-columns: minmax(0, 2fr) minmax(20rem, 1fr);
        gap: 4rem;
      }
      .item {
        display: grid;
        grid-template-columns: 10rem minmax(0, 1fr) auto;
        gap: 1.25rem;
        border-bottom: 1px solid var(--color-border);
        padding: 1.5rem 0;
      }
      .item img {
        display: block;
        width: 100%;
        height: auto;
        background: var(--color-border);
        border-radius: var(--radius-card);
      }
      .item-placeholder {
        display: grid;
        place-items: center;
        background: var(--color-border);
        border-radius: var(--radius-card);
        font-size: 0.8rem;
        color: var(--color-muted);
      }
      .item h2 {
        font-size: 1.15rem;
        margin: 0;
      }
      .item p {
        margin: 0.5rem 0;
      }
      .controls {
        display: grid;
        align-content: start;
        justify-items: end;
        gap: 1.5rem;
      }
      .controls label {
        display: grid;
        gap: 0.4rem;
      }
      .controls input {
        width: 5rem;
      }
      .summary {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        padding: 1.5rem;
        border-radius: var(--radius-card);
        align-self: start;
      }
      .summary h2 {
        margin-top: 0;
      }
      dl div {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.5rem 0;
      }
      dd {
        margin: 0;
      }
      .total {
        border-top: 1px solid var(--color-border);
        margin-top: 0.5rem;
        padding-top: 1rem;
        font-weight: 700;
      }
      .coupon {
        display: flex;
        gap: 0.5rem;
      }
      .coupon input {
        min-width: 0;
        flex: 1;
      }
      .checkout {
        width: 100%;
        margin-top: 1.5rem;
      }
      .text-button {
        border: 0;
        background: transparent;
        color: var(--color-ink);
        text-decoration: underline;
        padding: 0.25rem 0;
        min-height: 2rem;
      }
      .text-button:hover {
        background: transparent;
      }
      .warning,
      [role='alert'] {
        color: var(--color-danger);
      }
      .empty {
        text-align: center;
        padding: 6rem 0;
      }
      .button-link {
        display: inline-block;
        background: var(--color-ink);
        color: var(--color-surface);
        padding: 0.8rem 1.2rem;
        border-radius: var(--radius-button);
      }
      @media (max-width: 850px) {
        .layout {
          grid-template-columns: 1fr;
        }
        .item {
          grid-template-columns: 6rem minmax(0, 1fr);
        }
        .controls {
          grid-column: 2;
          justify-items: start;
        }
        .summary {
          width: 100%;
        }
      }
    `,
  ],
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
