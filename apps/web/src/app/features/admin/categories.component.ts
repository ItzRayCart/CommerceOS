import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { AdminCategory } from '@commerceos/shared';
import { AdminList } from './admin-list';
import { AdminFeedbackComponent } from './admin-feedback.component';
import { AdminPaginationComponent } from './admin-pagination.component';
import { AdminConfirmComponent } from './admin-confirm.component';
@Component({
  selector: 'adm-categories',
  imports: [
    ReactiveFormsModule,
    AdminFeedbackComponent,
    AdminPaginationComponent,
    AdminConfirmComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './admin-page.scss',
  template: `<h1>Categories</h1>
    <adm-feedback
      [loading]="list.state.loading()"
      [error]="list.state.error()"
      [message]="list.state.feedback()"
      (retry)="list.load()"
    />
    <div class="grid">
      <section class="panel">
        <h2>{{ editing() ? 'Edit category' : 'Create category' }}</h2>
        <form [formGroup]="form" (ngSubmit)="save()">
          <label>Category name<input formControlName="name" required /></label
          ><label>Slug<input formControlName="slug" placeholder="Generated when blank" /></label
          ><label
            >Parent category<select formControlName="parentId">
              <option value="">Top level</option>
              @for (c of list.state.data(); track c.id) {
                @if (!c.parentId && c.id !== editing()) {
                  <option [value]="c.id">{{ c.name }}</option>
                }
              }
            </select></label
          ><label>Description<textarea formControlName="description"></textarea></label
          ><label
            >Category image<input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              (change)="upload($event)"
          /></label>
          @if (form.controls.image.value) {
            <img [src]="form.controls.image.value" alt="Category image" width="120" height="90" />
          }
          <label>Sort order<input type="number" formControlName="sortOrder" min="0" /></label
          ><label class="check"
            ><input type="checkbox" formControlName="isActive" />Active on storefront</label
          >
          <div class="actions">
            <button class="primary" [disabled]="list.state.busy()">Save category</button
            ><button type="button" (click)="reset()">New category</button>
          </div>
        </form>
      </section>
      <section class="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Order</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (c of list.state.data(); track c.id) {
              <tr>
                <td>
                  {{ c.name }}<small>{{ c.parentId ? 'Child category' : 'Top level' }}</small>
                </td>
                <td>{{ c.sortOrder }}</td>
                <td>{{ c.isActive ? 'Active' : 'Hidden' }}</td>
                <td>
                  <button (click)="edit(c)">Edit</button
                  ><button (click)="remove(c)" [disabled]="list.state.busy()">Delete</button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="4">Create a category to start organizing products.</td>
              </tr>
            }
          </tbody>
        </table>
      </section>
    </div>
    <adm-pagination
      [meta]="list.state.meta()"
      (page)="list.page($event)"
      (limit)="list.limit($event)"
    /><adm-confirm />`,
})
export class CategoriesComponent {
  readonly list = new AdminList<AdminCategory>('/categories');
  readonly editing = signal<string | null>(null);
  readonly confirm = viewChild.required(AdminConfirmComponent);
  readonly form = inject(NonNullableFormBuilder).group({
    name: ['', Validators.required.bind(Validators)],
    slug: '',
    parentId: '',
    description: '',
    image: '',
    sortOrder: 0,
    isActive: true,
  });
  edit(c: AdminCategory) {
    this.editing.set(c.id);
    this.form.patchValue({ ...c, parentId: c.parentId ?? '' });
  }
  reset() {
    this.editing.set(null);
    this.form.reset();
  }
  async upload(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f)
      await this.list.state.mutate(async () => {
        this.form.controls.image.setValue((await this.list.api.upload([f])).data[0]?.url ?? '');
      }, 'Image uploaded.');
  }
  async save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.list.state.error.set('Enter a category name.');
      return;
    }
    const v = this.form.getRawValue();
    const body = { ...v, slug: v.slug || undefined, parentId: v.parentId || null };
    if (
      await this.list.state.mutate(
        () =>
          this.editing()
            ? this.list.api.patch(`/categories/${this.editing()}`, body)
            : this.list.api.post('/categories', body),
        'Category saved.',
      )
    ) {
      this.reset();
      await this.list.load();
    }
  }
  async remove(c: AdminCategory) {
    if (
      await this.confirm().ask(
        'Delete ' + c.name,
        'Categories with products or children cannot be deleted.',
      )
    )
      if (
        await this.list.state.mutate(
          () => this.list.api.delete(`/categories/${c.id}`),
          'Category deleted.',
        )
      )
        await this.list.load();
  }
}
