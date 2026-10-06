import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import type { OrderView } from '@commerceos/shared';
import { errorMessage } from '@web/core/api-error';
import { CheckoutApi } from './checkout.api';
@Component({
  selector: 'app-order-page',
  imports: [RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<main class="page-container">
    <p class="eyebrow">{{ confirmation ? 'Order received' : 'Your order' }}</p>
    <h1>{{ confirmation ? 'Thank you for your order.' : 'Order details' }}</h1>
    @if (loading()) {
      <div class="panel" role="status">Loading your order…</div>
    }
    @if (error()) {
      <p role="alert">{{ error() }}</p>
      <button (click)="load()">Retry</button>
    }
    @if (order(); as order) {
      <p>
        <strong>{{ order.orderNumber }}</strong> · <span class="badge">{{ order.status }}</span> ·
        {{ order.createdAt | date: 'mediumDate' }}
      </p>
      @if (confirmation) {
        <p>
          Your order is saved. A confirmation email is sent through the configured mail provider.
        </p>
      }
      <div class="layout">
        <section class="panel">
          <h2>Your items</h2>
          @for (line of order.items; track line.variantId) {
            <article class="line">
              @if (line.image) {
                <img [src]="line.image" [alt]="line.name" width="100" height="80" />
              }
              <div>
                <h3>{{ line.name }}</h3>
                <p>
                  {{ line.variantLabel }} · {{ line.sku }}<br />{{ line.quantity }} ×
                  {{ money(line.unitPrice) }}
                </p>
              </div>
              <strong>{{ money(line.lineTotal) }}</strong>
            </article>
          }
          <h2>Order timeline</h2>
          <ol class="timeline">
            @for (event of order.statusHistory; track $index) {
              <li>
                <strong>{{ event.status }}</strong
                ><br /><time>{{ event.at | date: 'medium' }}</time>
                @if (event.note) {
                  <p>{{ event.note }}</p>
                }
              </li>
            }
          </ol>
          @if (order.tracking) {
            <h3>Tracking</h3>
            <p>{{ order.tracking.carrier }} · {{ order.tracking.number }}</p>
          }
          @if (order.status === 'pending') {
            <button [disabled]="busy()" (click)="cancel()">
              {{ busy() ? 'Cancelling…' : 'Cancel order' }}
            </button>
          }
        </section>
        <aside class="panel">
          <h2>Delivery</h2>
          <address>
            {{ order.shippingAddress.fullName }}<br />{{ order.shippingAddress.line1 }}
            {{ order.shippingAddress.line2 }}<br />{{ order.shippingAddress.city }},
            {{ order.shippingAddress.region }} {{ order.shippingAddress.postalCode }}<br />{{
              order.shippingAddress.country
            }}<br />{{ order.shippingAddress.phone }}
          </address>
          <p>
            {{ order.shippingMethod.label }} · {{ order.shippingMethod.estimatedDays }} day estimate
          </p>
          <h2>Payment</h2>
          <p>
            {{
              order.payment.method === 'cod'
                ? 'Cash on delivery'
                : 'Mock card ending ' + order.payment.last4
            }}
            · {{ order.payment.status }}
          </p>
          <dl>
            <div>
              <dt>Subtotal</dt>
              <dd>{{ money(order.totals.subtotal) }}</dd>
            </div>
            <div>
              <dt>Discount{{ order.discount ? ' · ' + order.discount.code : '' }}</dt>
              <dd>−{{ money(order.totals.discount) }}</dd>
            </div>
            <div>
              <dt>Shipping</dt>
              <dd>{{ money(order.totals.shipping) }}</dd>
            </div>
            <div>
              <dt>Tax</dt>
              <dd>{{ money(order.totals.tax) }}</dd>
            </div>
            <div>
              <dt><strong>Total</strong></dt>
              <dd>
                <strong>{{ money(order.totals.total) }}</strong>
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    }
    <p>
      <a routerLink="/account/orders">Order history</a> ·
      <a routerLink="/shop">Continue shopping</a>
    </p>
  </main>`,
  styles: [
    `
      main {
        padding-bottom: 4rem;
      }
      .layout {
        display: grid;
        gap: 2rem;
      }
      .panel {
        padding: 1.5rem;
        border: 1px solid var(--color-border);
        background: var(--color-surface);
        border-radius: var(--radius-card);
        min-width: 0;
      }
      .line {
        display: flex;
        gap: 1rem;
        align-items: center;
        border-bottom: 1px solid var(--color-border);
        padding: 1rem 0;
      }
      .line img {
        max-width: 20%;
        height: auto;
      }
      .line div {
        flex: 1;
        min-width: 0;
      }
      .line h3 {
        margin: 0;
        font-size: 1rem;
      }
      .timeline {
        padding-left: 1.5rem;
      }
      .timeline li {
        padding: 0.5rem 0;
      }
      .badge {
        border: 1px solid var(--color-border);
        padding: 0.3rem 0.7rem;
        border-radius: var(--radius-pill);
        text-transform: capitalize;
      }
      address {
        font-style: normal;
        line-height: 1.8;
      }
      dl div {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.6rem 0;
      }
      dd {
        margin: 0;
      }
      [role='alert'] {
        color: var(--color-danger);
      }
      @media (min-width: 1024px) {
        .layout {
          grid-template-columns: minmax(0, 2fr) minmax(18rem, 1fr);
        }
      }
    `,
  ],
})
export class OrderPageComponent {
  private readonly api = inject(CheckoutApi);
  private readonly route = inject(ActivatedRoute);
  readonly confirmation = this.route.snapshot.data['confirmation'] === true;
  readonly order = signal<OrderView | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly busy = signal(false);
  constructor() {
    inject(Title).setTitle(this.confirmation ? 'Order confirmation' : 'Order details');
    void this.load();
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.order.set(
        (await firstValueFrom(this.api.order(this.route.snapshot.paramMap.get('orderNumber')!)))
          .data,
      );
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
  money(amount: number) {
    const currency = this.order()?.currency;
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency?.code ?? 'USD',
      minimumFractionDigits: currency?.decimals ?? 2,
    }).format(amount / 10 ** (currency?.decimals ?? 2));
  }
  async cancel() {
    if (!window.confirm('Cancel this order and restore its stock?')) return;
    this.busy.set(true);
    this.error.set('');
    try {
      this.order.set((await firstValueFrom(this.api.cancel(this.order()!.orderNumber))).data);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
