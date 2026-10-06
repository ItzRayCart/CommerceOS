import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { DashboardSummary } from '@commerceos/shared';
import { AdminApi } from './admin.api';
import { AdminState } from './admin-state';
import { AdminFeedbackComponent } from './admin-feedback.component';
import { RevenueChartComponent } from './revenue-chart.component';
import { SettingsStore } from '@web/core/settings-store';
@Component({
  selector: 'adm-dashboard',
  imports: [RouterLink, AdminFeedbackComponent, RevenueChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './admin-page.scss',
  template: `<div class="toolbar">
      <div>
        <p>Store performance</p>
        <h1>Overview</h1>
      </div>
      <label
        >Period<select [value]="range()" (change)="changeRange($event)">
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select></label
      ><button (click)="load()">Refresh dashboard</button>
    </div>
    <adm-feedback [loading]="state.loading()" [error]="state.error()" (retry)="load()" />
    @if (state.data(); as d) {
      <section class="kpis">
        @for (k of kpis; track k.key) {
          <article class="panel">
            <p>{{ k.label }}</p>
            <strong>{{ k.money ? settings.formatMoney(d[k.key].value) : d[k.key].value }}</strong
            ><small>{{
              d[k.key].delta === null
                ? 'No previous-period baseline'
                : d[k.key].delta + '% versus previous period'
            }}</small>
          </article>
        }
      </section>
      <div class="grid">
        <section class="panel">
          <div class="toolbar">
            <h2>Revenue</h2>
            <label
              >Chart window<select [value]="chartDays()" (change)="changeChart($event)">
                <option value="30">30 days</option>
                <option value="90">90 days</option>
              </select></label
            >
          </div>
          @defer (on immediate) {
            <adm-revenue-chart [points]="d.revenueSeries" />
          }
        </section>
        <section class="panel">
          <h2>Orders by status</h2>
          <div class="status-chart">
            <svg viewBox="0 0 100 100" role="img" aria-label="Order status distribution">
              @for (s of d.statusCounts; track s.status; let i = $index) {
                <circle
                  cx="50"
                  cy="50"
                  r="35"
                  fill="none"
                  [attr.class]="'segment segment--' + i"
                  [attr.stroke-dasharray]="donut(s.count, d.orders.value)"
                  [attr.stroke-dashoffset]="offset(i, d.statusCounts, d.orders.value)"
                />
              }
            </svg>
            <ul>
              @for (s of d.statusCounts; track s.status) {
                <li>{{ s.status }}: {{ s.count }}</li>
              } @empty {
                <li>No orders in this period.</li>
              }
            </ul>
          </div>
        </section>
        <section class="panel">
          <h2>Top products</h2>
          @for (p of d.topProducts; track p.productId) {
            <p>
              <a [routerLink]="['/admin/products', p.productId]">{{ p.name }}</a> ·
              {{ p.units }} units · {{ settings.formatMoney(p.revenue) }}
            </p>
          } @empty {
            <p>Paid orders will populate this list.</p>
          }
        </section>
        <section class="panel">
          <h2>Low stock</h2>
          @for (v of d.lowStock; track v.variantId) {
            <p>
              <a [routerLink]="['/admin/inventory']" [queryParams]="{ q: v.sku, low: 'true' }"
                >{{ v.name }} · {{ v.sku }}</a
              >
              — {{ v.stock }} left
            </p>
          } @empty {
            <p>All variants are above their thresholds.</p>
          }
          <a routerLink="/admin/inventory">Adjust stock and view movements →</a>
        </section>
      </div>
      <section class="panel">
        <h2>Inventory summary</h2>
        <div class="kpis">
          <p>{{ d.inventory.totalSkus }} SKUs</p>
          <p>{{ d.inventory.out }} out of stock</p>
          <p>{{ d.inventory.low }} low stock</p>
          <p>{{ settings.formatMoney(d.inventory.value) }} stock value</p>
        </div>
      </section>
      <section class="panel">
        <h2>Recent orders</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              @for (o of d.recentOrders; track o.id) {
                <tr>
                  <td>
                    <a [routerLink]="['/admin/orders', o.id]">{{ o.orderNumber }}</a>
                  </td>
                  <td>{{ o.customer.email }}</td>
                  <td>
                    <span class="badge">{{ o.status }}</span>
                  </td>
                  <td>{{ settings.formatMoney(o.totals.total) }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4">No orders yet.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    }`,
  styles: [
    `
      .status-chart {
        display: flex;
        gap: 1rem;
        align-items: center;
      }
      .status-chart svg {
        width: 10rem;
      }
      .segment {
        stroke: var(--color-accent);
        stroke-width: 12;
      }
      .segment--1,
      .segment--4 {
        stroke: var(--color-ink);
      }
      .segment--2,
      .segment--5 {
        stroke: var(--color-info);
      }
      .segment--3 {
        stroke: var(--color-success);
      }
    `,
  ],
})
export class DashboardComponent {
  readonly api = inject(AdminApi);
  readonly settings = inject(SettingsStore);
  readonly state = new AdminState<DashboardSummary>();
  readonly range = signal<'today' | '7d' | '30d'>('30d');
  readonly chartDays = signal(30);
  readonly kpis = [
    { key: 'revenue', label: 'Revenue', money: true },
    { key: 'orders', label: 'Orders', money: false },
    { key: 'customers', label: 'New customers', money: false },
    { key: 'aov', label: 'Average order value', money: true },
  ] as const;
  constructor() {
    void this.load();
  }
  async load() {
    await this.state.load(() =>
      this.api.get<DashboardSummary>('/dashboard/summary', {
        range: this.range(),
        chartDays: this.chartDays(),
      }),
    );
  }
  changeRange(e: Event) {
    this.range.set((e.target as HTMLSelectElement).value as 'today' | '7d' | '30d');
    void this.load();
  }
  changeChart(e: Event) {
    this.chartDays.set(+(e.target as HTMLSelectElement).value);
    void this.load();
  }
  donut(n: number, total: number) {
    return `${total ? (n / total) * 220 : 0} 220`;
  }
  offset(i: number, counts: { count: number }[], total: number) {
    return total ? (-counts.slice(0, i).reduce((s, c) => s + c.count, 0) / total) * 220 : 0;
  }
}
