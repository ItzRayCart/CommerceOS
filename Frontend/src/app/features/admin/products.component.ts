import { ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';
import { ReactiveFormsModule, NonNullableFormBuilder } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { AdminProduct, AdminCategory } from '@commerceos/shared';
import { AdminList } from './admin-list';
import { AdminFeedbackComponent } from './admin-feedback.component';
import { AdminPaginationComponent } from './admin-pagination.component';
import { AdminConfirmComponent } from './admin-confirm.component';
import { SettingsStore } from '@web/core/settings-store';
import { signal } from '@angular/core';
@Component({
  selector: 'adm-products',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    AdminFeedbackComponent,
    AdminPaginationComponent,
    AdminConfirmComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './admin-page.scss',
  template: `<div class="toolbar">
      <h1>Products</h1>
      <a routerLink="/admin/products/new">Create product →</a>
    </div>
    <form class="toolbar" [formGroup]="filters" (ngSubmit)="apply()">
      <label>Search products<input formControlName="q" placeholder="Name or description" /></label
      ><label
        >Status<select formControlName="status">
          <option value="">All statuses</option>
          @for (s of ['draft', 'active', 'archived']; track s) {
            <option [value]="s">{{ s }}</option>
          }
        </select></label
      ><label
        >Category<select formControlName="category">
          <option value="">All categories</option>
          @for (c of categories(); track c.id) {
            <option [value]="c.id">{{ c.name }}</option>
          }
        </select></label
      ><label
        >Stock<select formControlName="stock">
          <option value="">All stock</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </select></label
      ><label
        >Sort<select formControlName="sort">
          <option value="-createdAt">Newest</option>
          <option value="name">Name</option>
          <option value="minPrice">Price ↑</option>
          <option value="-minPrice">Price ↓</option>
        </select></label
      ><button>Apply filters</button>
    </form>
    <adm-feedback
      [loading]="list.state.loading()"
      [error]="list.state.error()"
      [message]="list.state.feedback()"
      (retry)="list.load()"
    />
    <section class="panel table-wrap">
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Status</th>
            <th>Price from</th>
            <th>Stock</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          @for (p of list.state.data(); track p.id) {
            <tr>
              <td>
                <a [routerLink]="['/admin/products', p.id]">{{ p.name }}</a
                ><small>{{ p.variants.length }} variants</small>
              </td>
              <td>
                <span class="badge">{{ p.status }}</span>
              </td>
              <td>{{ settings.formatMoney(p.minPrice) }}</td>
              <td>{{ p.totalStock }}</td>
              <td>
                <div class="actions">
                  <button [disabled]="list.state.busy()" (click)="duplicate(p)">Duplicate</button
                  ><button [disabled]="list.state.busy()" (click)="archive(p)">Archive</button
                  ><button [disabled]="list.state.busy()" (click)="remove(p)">Delete</button>
                </div>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="5">
                No products match. Clear the filters or create your first product.
              </td>
            </tr>
          }
        </tbody>
      </table>
    </section>
    <adm-pagination
      [meta]="list.state.meta()"
      (page)="list.page($event)"
      (limit)="list.limit($event)"
    /><adm-confirm />`,
})
export class ProductsComponent {
  readonly list = new AdminList<AdminProduct>('/products');
  readonly settings = inject(SettingsStore);
  readonly filters = inject(NonNullableFormBuilder).group({
    q: '',
    status: '',
    category: '',
    stock: '',
    sort: '-createdAt',
  });
  readonly categories = signal<AdminCategory[]>([]);
  readonly confirm = viewChild.required(AdminConfirmComponent);
  constructor() {
    this.filters.patchValue(this.list.params);
    void this.list.api
      .get<AdminCategory[]>('/categories', { limit: 100 })
      .then((r) => this.categories.set(r.data))
      .catch(() => this.list.state.error.set('Categories could not be loaded.'));
  }
  apply() {
    const v = this.filters.getRawValue();
    this.list.filter({
      q: v.q || null,
      status: v.status || null,
      category: v.category || null,
      stock: v.stock || null,
      sort: v.sort,
    });
  }
  async duplicate(p: AdminProduct) {
    await this.list.state.mutate(async () => {
      const r = await this.list.api.post<AdminProduct>(`/products/${p.id}/duplicate`, {});
      await this.list.router.navigate(['/admin/products', r.data.id]);
    }, 'Product duplicated as a draft.');
  }
  async archive(p: AdminProduct) {
    if (
      await this.confirm().ask(
        'Archive ' + p.name,
        'This product will be hidden from the storefront.',
      )
    ) {
      if (
        await this.list.state.mutate(
          () => this.list.api.patch(`/products/${p.id}`, { status: 'archived' }),
          'Product archived.',
        )
      )
        await this.list.load();
    }
  }
  async remove(p: AdminProduct) {
    if (
      await this.confirm().ask(
        'Delete ' + p.name,
        'Products with orders must be archived. This deletion cannot be undone.',
      )
    ) {
      if (
        await this.list.state.mutate(
          () => this.list.api.delete(`/products/${p.id}`),
          'Product deleted.',
        )
      )
        await this.list.load();
    }
  }
}
