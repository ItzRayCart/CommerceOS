import { ChangeDetectionStrategy, Component, inject, viewChild, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import type { AdminCustomer, AdminOrder } from '@commerceos/shared';
import { AdminApi } from './admin.api';
import { AdminState } from './admin-state';
import { AdminFeedbackComponent } from './admin-feedback.component';
import { AdminConfirmComponent } from './admin-confirm.component';
import { AdminPaginationComponent } from './admin-pagination.component';
import { SettingsStore } from '@web/core/settings-store';
@Component({
  selector: 'adm-customer-detail',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    AdminFeedbackComponent,
    AdminConfirmComponent,
    AdminPaginationComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './admin-page.scss',
  template: `<a routerLink="/admin/customers">← Customers</a
    ><adm-feedback
      [loading]="state.loading()"
      [error]="state.error()"
      [message]="state.feedback()"
      (retry)="load()"
    />
    @if (state.data(); as c) {
      <h1>{{ c.firstName }} {{ c.lastName }}</h1>
      <div class="grid">
        <section class="panel">
          <h2>Profile</h2>
          <p>{{ c.email }}</p>
          <p>{{ c.status }} · {{ c.role }}</p>
          <strong>Lifetime value {{ settings.formatMoney(c.lifetimeValue ?? 0) }}</strong>
          <h2>Addresses</h2>
          @for (a of c.addresses; track $index) {
            <p>
              {{ a.fullName }} · {{ a.line1 }}<br />{{ a.city }} {{ a.country }} · {{ a.phone }}
            </p>
          } @empty {
            <p>No saved addresses.</p>
          }
        </section>
        <section class="panel">
          <h2>Account access</h2>
          <p>You cannot disable or demote yourself or remove the last active administrator.</p>
          <form [formGroup]="form" (ngSubmit)="save()">
            <label
              >Role<select formControlName="role">
                <option value="customer">Customer</option>
                <option value="admin">Administrator</option>
              </select></label
            ><label
              >Status<select formControlName="status">
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select></label
            ><button [disabled]="state.busy()">Update account</button>
          </form>
        </section>
      </div>
      <section class="panel">
        <h2>Order history</h2>
        <adm-feedback
          [loading]="orders.loading()"
          [error]="orders.error()"
          (retry)="loadOrders()"
        />
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Status</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              @for (o of orders.data(); track o.id) {
                <tr>
                  <td>
                    <a [routerLink]="['/admin/orders', o.id]">{{ o.orderNumber }}</a>
                  </td>
                  <td>{{ o.status }}</td>
                  <td>{{ settings.formatMoney(o.totals.total) }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="3">No orders yet.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <adm-pagination
          [meta]="orders.meta()"
          (page)="page.set($event); loadOrders()"
          (limit)="limit.set($event); page.set(1); loadOrders()"
        />
      </section>
    }
    <adm-confirm />`,
})
export class CustomerDetailComponent {
  readonly api = inject(AdminApi);
  readonly settings = inject(SettingsStore);
  readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';
  readonly state = new AdminState<AdminCustomer>();
  readonly orders = new AdminState<AdminOrder[]>();
  readonly page = signal(1);
  readonly limit = signal(20);
  readonly form = inject(NonNullableFormBuilder).group({ role: 'customer', status: 'active' });
  readonly confirm = viewChild.required(AdminConfirmComponent);
  constructor() {
    void this.load();
  }
  async load() {
    await this.state.load(() => this.api.get<AdminCustomer>(`/customers/${this.id}`));
    const c = this.state.data();
    if (c) {
      this.form.patchValue(c);
      await this.loadOrders();
    }
  }
  async loadOrders() {
    const c = this.state.data();
    if (c)
      await this.orders.load(() =>
        this.api.get<AdminOrder[]>('/orders', {
          q: c.email,
          page: this.page(),
          limit: this.limit(),
        }),
      );
  }
  async save() {
    if (
      await this.confirm().ask(
        'Update ' + this.state.data()?.email,
        'This change affects access to the store and admin console.',
      )
    )
      if (
        await this.state.mutate(
          () => this.api.patch(`/customers/${this.id}`, this.form.getRawValue()),
          'Account updated.',
        )
      )
        await this.load();
  }
}
