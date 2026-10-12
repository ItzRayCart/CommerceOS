import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import type {
  RevenuePoint,
  ProductMetric,
  NamedMetric,
  CustomerMetrics,
  DiscountMetric,
} from '@commerceos/shared';
import { AdminApi } from './admin.api';
import { AdminState } from './admin-state';
import { AdminFeedbackComponent } from './admin-feedback.component';
import { RevenueChartComponent } from './revenue-chart.component';
import { SettingsStore } from '@web/core/settings-store';
import { ActivatedRoute, Router } from '@angular/router';
@Component({
  selector: 'adm-analytics',
  imports: [ReactiveFormsModule, AdminFeedbackComponent, RevenueChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './admin-page.scss',
  template: `<h1>Analytics</h1>
    <form class="toolbar" [formGroup]="form" (ngSubmit)="apply()">
      <label>From date<input type="date" formControlName="from" /></label
      ><label>To date<input type="date" formControlName="to" /></label
      ><label
        >Granularity<select formControlName="granularity">
          <option value="day">Day</option>
          <option value="week">Week</option>
          <option value="month">Month</option>
        </select></label
      ><label
        >Top products by<select formControlName="sort">
          <option value="revenue">Revenue</option>
          <option value="units">Units</option>
        </select></label
      ><button>Apply date range</button
      ><button type="button" (click)="export('orders')" [disabled]="state.busy()">
        Export orders CSV</button
      ><button type="button" (click)="export('products')" [disabled]="state.busy()">
        Export products CSV
      </button>
    </form>
    <adm-feedback
      [loading]="state.loading()"
      [error]="state.error()"
      [message]="state.feedback()"
      (retry)="load()"
    />
    <section class="panel">
      <h2>Revenue and orders over time</h2>
      @defer (on immediate) {
        <adm-revenue-chart [points]="series()" />
      }
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>UTC date</th>
              <th>Revenue</th>
              <th>Orders</th>
              <th>AOV</th>
            </tr>
          </thead>
          <tbody>
            @for (p of series(); track p.date) {
              <tr>
                <td>{{ p.date }}</td>
                <td>{{ settings.formatMoney(p.revenue) }}</td>
                <td>{{ p.orders }}</td>
                <td>{{ settings.formatMoney(p.aov) }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="4">No paid sales in the selected range.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
    <div class="grid">
      <section class="panel">
        <h2>Top products</h2>
        @for (p of products(); track p.productId) {
          <p>{{ p.name }} · {{ p.units }} units · {{ settings.formatMoney(p.revenue) }}</p>
        } @empty {
          <p>No sales yet.</p>
        }
      </section>
      <section class="panel">
        <h2>Sales by category</h2>
        @for (c of categories(); track c.name) {
          <p>{{ c.name }} · {{ c.units }} units · {{ settings.formatMoney(c.revenue) }}</p>
        } @empty {
          <p>No category sales.</p>
        }
      </section>
      <section class="panel">
        <h2>Customer acquisition</h2>
        <p>
          {{ customers()?.newCustomers ?? 0 }} new customers ·
          {{ customers()?.returningCustomers ?? 0 }} returning buyers
        </p>
        @for (p of customers()?.series; track p.date) {
          <p>{{ p.date }} · {{ p.count }} joined</p>
        }
      </section>
      <section class="panel">
        <h2>Discount usage</h2>
        @for (d of discounts(); track d.code) {
          <p>
            {{ d.code }} · {{ d.redemptions }} uses ·
            {{ settings.formatMoney(d.discounted) }} discounted
          </p>
        } @empty {
          <p>No redemptions in this range.</p>
        }
      </section>
    </div>`,
})
export class AnalyticsComponent {
  readonly api = inject(AdminApi);
  readonly settings = inject(SettingsStore);
  readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  readonly state = new AdminState<never>();
  readonly form = inject(NonNullableFormBuilder).group({
    from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
    granularity: 'day',
    sort: 'revenue',
  });
  readonly series = signal<RevenuePoint[]>([]);
  readonly products = signal<ProductMetric[]>([]);
  readonly categories = signal<NamedMetric[]>([]);
  readonly customers = signal<CustomerMetrics | null>(null);
  readonly discounts = signal<DiscountMetric[]>([]);
  constructor() {
    this.form.patchValue(
      Object.fromEntries(
        this.route.snapshot.queryParamMap.keys.map((k) => [
          k,
          this.route.snapshot.queryParamMap.get(k),
        ]),
      ),
    );
    void this.load();
  }
  params() {
    const v = this.form.getRawValue();
    return {
      from: new Date(v.from).toISOString(),
      to: new Date(v.to + 'T23:59:59.999Z').toISOString(),
      granularity: v.granularity,
      sort: v.sort,
      limit: 100,
    };
  }
  async apply() {
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.form.getRawValue(),
    });
    await this.load();
  }
  async load() {
    this.state.loading.set(true);
    this.state.error.set('');
    await this.state.mutate(async () => {
      const q = this.params();
      const [r, p, c, u, d] = await Promise.all([
        this.api.get<RevenuePoint[]>('/analytics/revenue', q),
        this.api.get<ProductMetric[]>('/analytics/top-products', q),
        this.api.get<NamedMetric[]>('/analytics/categories', q),
        this.api.get<CustomerMetrics>('/analytics/customers', q),
        this.api.get<DiscountMetric[]>('/analytics/discounts', q),
      ]);
      this.series.set(r.data);
      this.products.set(p.data);
      this.categories.set(c.data);
      this.customers.set(u.data);
      this.discounts.set(d.data);
    }, '');
    this.state.loading.set(false);
  }
  async export(type: 'orders' | 'products') {
    await this.state.mutate(
      () =>
        this.api.download(
          `/export/${type}.csv`,
          type === 'orders' ? { from: this.params().from, to: this.params().to } : {},
        ),
      'Export downloaded.',
    );
  }
}
