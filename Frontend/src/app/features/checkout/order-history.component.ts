import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import type { OrderView, PaginationMeta } from '@commerceos/shared';
import { errorMessage } from '@web/core/api-error';
import { CheckoutApi } from './checkout.api';
@Component({
  selector: 'app-order-history',
  imports: [RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<main class="page-container">
    <p class="eyebrow">Your purchases</p>
    <h1>Order history</h1>
    <nav aria-label="Filter orders">
      @for (status of statuses; track status) {
        <a routerLink="/account/orders" [queryParams]="status ? { status } : {}">{{
          status || 'All'
        }}</a>
      }
    </nav>
    @if (loading()) {
      <section class="panel" role="status">Loading your orders…</section>
    }
    @if (error()) {
      <p role="alert">{{ error() }}</p>
      <button (click)="load()">Retry</button>
    }
    @if (!loading() && !error()) {
      @for (order of orders(); track order.id) {
        <article class="panel">
          <div>
            <a [routerLink]="['/account/orders', order.orderNumber]"
              ><strong>{{ order.orderNumber }}</strong></a
            >
            <p>{{ order.createdAt | date: 'mediumDate' }} · {{ order.items.length }} items</p>
          </div>
          <span class="badge">{{ order.status }}</span
          ><strong>{{ money(order) }}</strong>
        </article>
      }
      @if (!orders().length) {
        <section class="panel">
          <h2>No orders yet.</h2>
          <p>Your purchases will appear here.</p>
          <a routerLink="/shop">Explore products</a>
        </section>
      }
      @if (meta(); as meta) {
        <nav aria-label="Order pages">
          @if (meta.hasPrev) {
            <a
              routerLink="/account/orders"
              queryParamsHandling="merge"
              [queryParams]="{ page: meta.page - 1 }"
              >Previous</a
            >
          }
          <span>Page {{ meta.page }} of {{ meta.totalPages || 1 }}</span>
          @if (meta.hasNext) {
            <a
              routerLink="/account/orders"
              queryParamsHandling="merge"
              [queryParams]="{ page: meta.page + 1 }"
              >Next</a
            >
          }
        </nav>
      }
    }
  </main>`,
  styles: [
    `
      main {
        padding-bottom: 4rem;
      }
      nav {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
        margin: 1.5rem 0;
        text-transform: capitalize;
      }
      .panel {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
        padding: 1.5rem;
        margin-bottom: 1rem;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-card);
      }
      .panel div {
        flex: 1;
        min-width: 10rem;
      }
      .badge {
        border: 1px solid var(--color-border);
        border-radius: var(--radius-pill);
        padding: 0.4rem 0.75rem;
        text-transform: capitalize;
      }
      [role='alert'] {
        color: var(--color-danger);
      }
    `,
  ],
})
export class OrderHistoryComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(CheckoutApi);
  private sequence = 0;
  readonly orders = signal<OrderView[]>([]);
  readonly meta = signal<PaginationMeta | undefined>(undefined);
  readonly error = signal('');
  readonly loading = signal(false);
  readonly statuses = ['', 'pending', 'paid', 'shipped', 'completed', 'cancelled', 'refunded'];
  constructor() {
    inject(Title).setTitle('Order history');
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(() => {
      void this.load();
    });
  }
  async load() {
    const seq = ++this.sequence;
    this.loading.set(true);
    this.error.set('');
    try {
      const query = this.route.snapshot.queryParamMap;
      const result = await firstValueFrom(
        this.api.orders(Number(query.get('page') ?? 1), query.get('status') ?? undefined),
      );
      if (seq === this.sequence) {
        this.orders.set(result.data);
        this.meta.set(result.meta);
      }
    } catch (error) {
      if (seq === this.sequence) this.error.set(errorMessage(error));
    } finally {
      if (seq === this.sequence) this.loading.set(false);
    }
  }
  money(order: OrderView) {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: order.currency.code,
      minimumFractionDigits: order.currency.decimals,
    }).format(order.totals.total / 10 ** order.currency.decimals);
  }
}
