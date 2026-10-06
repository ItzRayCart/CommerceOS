import type { ElementRef } from '@angular/core';
import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { InventoryRow, StockMovement } from '@commerceos/shared';
import { AdminList } from './admin-list';
import { AdminState } from './admin-state';
import { AdminFeedbackComponent } from './admin-feedback.component';
import { AdminPaginationComponent } from './admin-pagination.component';
@Component({
  selector: 'adm-inventory',
  imports: [ReactiveFormsModule, RouterLink, AdminFeedbackComponent, AdminPaginationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './admin-page.scss',
  template: `<h1>Inventory</h1>
    <form class="toolbar" [formGroup]="filters" (ngSubmit)="apply()">
      <label>Search SKU or product<input formControlName="q" /></label
      ><label class="check"><input type="checkbox" formControlName="low" />Low stock</label
      ><label class="check"><input type="checkbox" formControlName="out" />Out of stock</label
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
            <th>Product / SKU</th>
            <th>Stock</th>
            <th>Threshold</th>
            <th>Adjust stock</th>
            <th>Audit</th>
          </tr>
        </thead>
        <tbody>
          @for (v of list.state.data(); track v.variantId) {
            <tr>
              <td>
                <a [routerLink]="['/admin/products', v.productId]">{{ v.name }}</a
                ><small>{{ v.sku }}</small>
              </td>
              <td>
                {{ v.stock }}
                <span class="badge">{{
                  v.stock === 0 ? 'Out' : v.stock <= v.lowStockThreshold ? 'Low' : 'Healthy'
                }}</span>
              </td>
              <td>{{ v.lowStockThreshold }}</td>
              <td>
                <button (click)="adjust(v)">Adjust {{ v.sku }}</button>
              </td>
              <td><button (click)="history(v)">Movement history</button></td>
            </tr>
          } @empty {
            <tr>
              <td colspan="5">No matching variants. Try clearing the stock filters.</td>
            </tr>
          }
        </tbody>
      </table>
    </section>
    <adm-pagination
      [meta]="list.state.meta()"
      (page)="list.page($event)"
      (limit)="list.limit($event)"
    />
    <dialog #adjustDialog aria-labelledby="adjust-title">
      <h2 id="adjust-title">Adjust {{ selected()?.sku }}</h2>
      <p>Current stock: {{ selected()?.stock }}</p>
      <form [formGroup]="form" (ngSubmit)="save()">
        <label>Adjustment delta<input type="number" step="1" formControlName="delta" /></label
        ><label
          >Reason<select formControlName="reason">
            <option value="manual_adjustment">Manual adjustment</option>
            <option value="restock">Restock</option>
          </select></label
        ><label>Adjustment note<textarea formControlName="note" required></textarea></label
        ><adm-feedback [error]="list.state.error()" />
        <div class="actions">
          <button class="primary" [disabled]="list.state.busy()">Save adjustment</button
          ><button type="button" (click)="close()">Close</button>
        </div>
      </form>
    </dialog>
    <dialog #historyDialog aria-labelledby="history-title">
      <h2 id="history-title">Movements for {{ selected()?.sku }}</h2>
      <adm-feedback
        [loading]="movements.loading()"
        [error]="movements.error()"
        (retry)="loadHistory()"
      />
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>UTC time</th>
              <th>Delta</th>
              <th>Stock after</th>
              <th>Reason / note</th>
            </tr>
          </thead>
          <tbody>
            @for (m of movements.data(); track m.id) {
              <tr>
                <td>{{ m.createdAt }}</td>
                <td>{{ m.delta }}</td>
                <td>{{ m.stockAfter }}</td>
                <td>
                  {{ m.reason }}<small>{{ m.note }}</small>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="4">No movements recorded for this variant.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <adm-pagination
        [meta]="movements.meta()"
        (page)="historyPage = $event; loadHistory()"
        (limit)="historyLimit = $event; historyPage = 1; loadHistory()"
      /><button (click)="historyDialog.close()">Close history</button>
    </dialog>`,
})
export class InventoryComponent {
  readonly list = new AdminList<InventoryRow>('/inventory');
  readonly fb = inject(NonNullableFormBuilder);
  readonly filters = this.fb.group({ q: '', low: false, out: false });
  readonly form = this.fb.group({
    delta: 0,
    reason: 'manual_adjustment',
    note: ['', Validators.required.bind(Validators)],
  });
  readonly selected = signal<InventoryRow | null>(null);
  readonly movements = new AdminState<StockMovement[]>();
  readonly adjustDialog = viewChild.required<ElementRef<HTMLDialogElement>>('adjustDialog');
  readonly historyDialog = viewChild.required<ElementRef<HTMLDialogElement>>('historyDialog');
  historyPage = 1;
  historyLimit = 20;
  constructor() {
    this.filters.patchValue({
      q: String(this.list.params['q'] ?? ''),
      low: this.list.params['low'] === 'true',
      out: this.list.params['out'] === 'true',
    });
  }
  apply() {
    const v = this.filters.getRawValue();
    this.list.filter({ q: v.q || null, low: v.low ? 'true' : null, out: v.out ? 'true' : null });
  }
  adjust(v: InventoryRow) {
    this.selected.set(v);
    this.form.reset();
    this.list.state.error.set('');
    this.adjustDialog().nativeElement.showModal();
  }
  close() {
    this.adjustDialog().nativeElement.close();
  }
  async save() {
    const v = this.selected();
    if (!v || this.form.invalid || this.form.controls.delta.value === 0) {
      this.list.state.error.set('Enter a non-zero integer delta and a note.');
      return;
    }
    if (
      await this.list.state.mutate(
        () =>
          this.list.api.post(
            `/products/${v.productId}/variants/${v.variantId}/stock`,
            this.form.getRawValue(),
          ),
        'Stock adjusted and audit movement recorded.',
      )
    ) {
      this.close();
      await this.list.load();
    }
  }
  async history(v: InventoryRow) {
    this.selected.set(v);
    this.historyPage = 1;
    this.historyDialog().nativeElement.showModal();
    await this.loadHistory();
  }
  async loadHistory() {
    await this.movements.load(() =>
      this.list.api.get<StockMovement[]>('/inventory/movements', {
        variantId: this.selected()?.variantId ?? '',
        page: this.historyPage,
        limit: this.historyLimit,
      }),
    );
  }
}
