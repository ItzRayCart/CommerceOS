import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { AdminDiscount, AdminCategory, AdminProduct } from '@commerceos/shared';
import { AdminList } from './admin-list';
import { AdminFeedbackComponent } from './admin-feedback.component';
import { AdminPaginationComponent } from './admin-pagination.component';
import { AdminConfirmComponent } from './admin-confirm.component';
@Component({
  selector: 'adm-discounts',
  imports: [
    ReactiveFormsModule,
    AdminFeedbackComponent,
    AdminPaginationComponent,
    AdminConfirmComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './admin-page.scss',
  templateUrl: './discounts.component.html',
})
export class DiscountsComponent {
  readonly list = new AdminList<AdminDiscount>('/discounts');
  readonly fb = inject(NonNullableFormBuilder);
  readonly editing = signal<string | null>(null);
  readonly categories = signal<AdminCategory[]>([]);
  readonly products = signal<AdminProduct[]>([]);
  readonly confirm = viewChild.required(AdminConfirmComponent);
  readonly filters = this.fb.group({ q: '', status: '' });
  readonly form = this.fb.group({
    code: ['', Validators.required.bind(Validators)],
    description: '',
    type: 'percentage',
    value: 10,
    minSubtotal: 0,
    maxDiscount: '',
    startsAt: '',
    expiresAt: '',
    usageLimit: '',
    perUserLimit: 1,
    categories: [[] as string[]],
    products: [[] as string[]],
    isActive: true,
  });
  constructor() {
    void this.scopes();
    this.filters.patchValue(this.list.params);
  }
  async scopes() {
    try {
      this.categories.set(
        (await this.list.api.get<AdminCategory[]>('/categories', { limit: 100 })).data,
      );
      this.products.set(
        (await this.list.api.get<AdminProduct[]>('/products', { limit: 100 })).data,
      );
    } catch {
      this.list.state.error.set(
        'Discount scope could not be loaded. Retry to load categories and products.',
      );
    }
  }
  apply() {
    const v = this.filters.getRawValue();
    this.list.filter({ q: v.q || null, status: v.status || null });
  }
  reset() {
    this.editing.set(null);
    this.form.reset();
  }
  async edit(d: AdminDiscount) {
    this.editing.set(d.id);
    const dto = (await this.list.api.get<AdminDiscount>(`/discounts/${d.id}`)).data;
    this.form.patchValue({
      ...dto,
      maxDiscount: dto.maxDiscount === undefined ? '' : String(dto.maxDiscount),
      usageLimit: dto.usageLimit === undefined ? '' : String(dto.usageLimit),
      startsAt: dto.startsAt?.slice(0, 16) ?? '',
      expiresAt: dto.expiresAt?.slice(0, 16) ?? '',
      categories: dto.appliesTo.categories,
      products: dto.appliesTo.products,
    });
    this.list.state.feedback.set(
      `${dto.redemptions ?? 0} redemptions · ${dto.discounted ?? 0} minor units discounted.`,
    );
  }
  async save() {
    if (this.form.invalid) {
      this.list.state.error.set('Enter a valid discount code.');
      return;
    }
    const v = this.form.getRawValue();
    const payload = {
      code: v.code,
      description: v.description,
      type: v.type,
      value: v.value,
      minSubtotal: v.minSubtotal,
      ...(v.maxDiscount ? { maxDiscount: Number(v.maxDiscount) } : {}),
      ...(v.usageLimit ? { usageLimit: Number(v.usageLimit) } : {}),
      ...(v.startsAt ? { startsAt: new Date(v.startsAt).toISOString() } : {}),
      ...(v.expiresAt ? { expiresAt: new Date(v.expiresAt).toISOString() } : {}),
      perUserLimit: v.perUserLimit,
      appliesTo: { categories: v.categories, products: v.products },
      isActive: v.isActive,
    };
    if (
      await this.list.state.mutate(
        () =>
          this.editing()
            ? this.list.api.patch(`/discounts/${this.editing()}`, payload)
            : this.list.api.post('/discounts', payload),
        'Discount saved.',
      )
    ) {
      this.reset();
      await this.list.load();
    }
  }
  async remove(d: AdminDiscount) {
    if (
      await this.confirm().ask(
        'Delete ' + d.code,
        'The code stops working. Historical order snapshots and redemption audit records remain.',
      )
    )
      if (
        await this.list.state.mutate(
          () => this.list.api.delete(`/discounts/${d.id}`),
          'Discount deleted.',
        )
      )
        await this.list.load();
  }
}
