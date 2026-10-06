import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { AdminOrder } from '@commerceos/shared';
import { AdminList } from './admin-list';
import { AdminFeedbackComponent } from './admin-feedback.component';
import { AdminPaginationComponent } from './admin-pagination.component';
import { SettingsStore } from '@web/core/settings-store';
@Component({
  selector: 'adm-orders',
  imports: [RouterLink, ReactiveFormsModule, AdminFeedbackComponent, AdminPaginationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './admin-page.scss',
  template: `<h1>Orders</h1>
    <nav class="toolbar" aria-label="Order statuses">
      @for (
        s of ['', 'pending', 'paid', 'shipped', 'completed', 'cancelled', 'refunded'];
        track s
      ) {
        <button
          [attr.aria-pressed]="(list.params['status'] || '') === s"
          (click)="list.filter({ status: s || null })"
        >
          {{ s || 'All' }} {{ s ? (counts[s] ?? 0) : list.state.meta()?.total }}
        </button>
      }
    </nav>
    <form class="toolbar" [formGroup]="filters" (ngSubmit)="apply()">
      <label>Order number or customer email<input formControlName="q" /></label
      ><label>From<input type="date" formControlName="from" /></label
      ><label>To<input type="date" formControlName="to" /></label
      ><label
        >Sort<select formControlName="sort">
          <option value="-createdAt">Newest first</option>
          <option value="createdAt">Oldest first</option>
        </select></label
      ><button>Apply filters</button>
    </form>
    <adm-feedback
      [loading]="list.state.loading()"
      [error]="list.state.error()"
      (retry)="reload()"
    />
    <section class="panel table-wrap">
      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Status</th>
            <th>Total</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          @for (o of list.state.data(); track o.id) {
            <tr>
              <td>
                <a [routerLink]="['/admin/orders', o.id]">{{ o.orderNumber }}</a>
              </td>
              <td>{{ o.customer.email }}</td>
              <td>
                <span class="badge">{{ o.status }}</span>
              </td>
              <td>{{ settings.formatMoney(o.totals.total) }}</td>
              <td>{{ date(o.createdAt) }}</td>
            </tr>
          } @empty {
            <tr>
              <td colspan="5">No orders match this view.</td>
            </tr>
          }
        </tbody>
      </table>
    </section>
    <adm-pagination
      [meta]="list.state.meta()"
      (page)="list.page($event)"
      (limit)="list.limit($event)"
    />`,
})
export class OrdersComponent {
  readonly list = new AdminList<AdminOrder>('/orders');
  readonly settings = inject(SettingsStore);
  readonly filters = inject(NonNullableFormBuilder).group({
    q: '',
    from: '',
    to: '',
    sort: '-createdAt',
  });
  get counts(): Record<string, number | undefined> {
    const meta = this.list.state.meta();
    return meta && 'statusCounts' in meta ? (meta.statusCounts as Record<string, number>) : {};
  }
  constructor() {
    this.filters.patchValue({
      q: String(this.list.params['q'] ?? ''),
      from: String(this.list.params['from'] ?? '').slice(0, 10),
      to: String(this.list.params['to'] ?? '').slice(0, 10),
      sort: String(this.list.params['sort'] ?? '-createdAt'),
    });
  }
  async reload() {
    await this.list.load();
  }
  apply() {
    const v = this.filters.getRawValue();
    this.list.filter({
      q: v.q || null,
      from: v.from ? new Date(v.from).toISOString() : null,
      to: v.to ? new Date(v.to + 'T23:59:59.999Z').toISOString() : null,
      sort: v.sort,
    });
  }
  date(v: string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(v));
  }
}
