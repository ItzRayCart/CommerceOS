import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { AdminCustomer } from '@commerceos/shared';
import { AdminList } from './admin-list';
import { AdminFeedbackComponent } from './admin-feedback.component';
import { AdminPaginationComponent } from './admin-pagination.component';
import { SettingsStore } from '@web/core/settings-store';
@Component({
  selector: 'adm-customers',
  imports: [ReactiveFormsModule, RouterLink, AdminFeedbackComponent, AdminPaginationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './admin-page.scss',
  template: `<h1>Customers</h1>
    <form class="toolbar" [formGroup]="filters" (ngSubmit)="apply()">
      <label>Name or email<input formControlName="q" /></label
      ><label
        >Account status<select formControlName="status">
          <option value="">All accounts</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select></label
      ><label
        >Sort<select formControlName="sort">
          <option value="-joined">Recently joined</option>
          <option value="-orders">Most orders</option>
          <option value="-spent">Highest spend</option>
          <option value="name">Name</option>
        </select></label
      ><button>Apply filters</button>
    </form>
    <adm-feedback
      [loading]="list.state.loading()"
      [error]="list.state.error()"
      (retry)="list.load()"
    />
    <section class="panel table-wrap">
      <table>
        <thead>
          <tr>
            <th>Customer</th>
            <th>Status / role</th>
            <th>Orders</th>
            <th>Lifetime spend</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          @for (c of list.state.data(); track c.id) {
            <tr>
              <td>
                <a [routerLink]="['/admin/customers', c.id]">{{ c.firstName }} {{ c.lastName }}</a
                ><small>{{ c.email }}</small>
              </td>
              <td>{{ c.status }} · {{ c.role }}</td>
              <td>{{ c.stats.orderCount }}</td>
              <td>{{ settings.formatMoney(c.stats.totalSpent) }}</td>
              <td>{{ date(c.createdAt) }}</td>
            </tr>
          } @empty {
            <tr>
              <td colspan="5">No matching customers.</td>
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
export class CustomersComponent {
  readonly list = new AdminList<AdminCustomer>('/customers');
  readonly settings = inject(SettingsStore);
  readonly filters = inject(NonNullableFormBuilder).group({ q: '', status: '', sort: '-joined' });
  constructor() {
    this.filters.patchValue(this.list.params);
  }
  apply() {
    const v = this.filters.getRawValue();
    this.list.filter({ q: v.q || null, status: v.status || null, sort: v.sort });
  }
  date(v: string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(v));
  }
}
