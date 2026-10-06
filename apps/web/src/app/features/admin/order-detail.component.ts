import type { ElementRef } from '@angular/core';
import { ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { AdminOrder } from '@commerceos/shared';
import { AdminApi } from './admin.api';
import { AdminState } from './admin-state';
import { AdminFeedbackComponent } from './admin-feedback.component';
import { AdminConfirmComponent } from './admin-confirm.component';
import { SettingsStore } from '@web/core/settings-store';
@Component({
  selector: 'adm-order-detail',
  imports: [RouterLink, ReactiveFormsModule, AdminFeedbackComponent, AdminConfirmComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './admin-page.scss',
  template: `<a routerLink="/admin/orders">← Orders</a
    ><adm-feedback
      [loading]="state.loading()"
      [error]="state.error()"
      [message]="state.feedback()"
      (retry)="load()"
    />
    @if (state.data(); as o) {
      <div class="toolbar">
        <h1>{{ o.orderNumber }}</h1>
        <span class="badge">{{ o.status }}</span>
        @if (o.status === 'pending') {
          <button [disabled]="state.busy()" (click)="change('paid')">Mark paid</button>
        }
        @if (o.status === 'paid') {
          <button (click)="shipDialog.showModal()">Mark shipped</button>
        }
        @if (o.status === 'pending' || o.status === 'paid') {
          <button [disabled]="state.busy()" (click)="change('cancelled')">Cancel order</button>
        }
        @if (o.status === 'shipped') {
          <button [disabled]="state.busy()" (click)="change('completed')">Complete order</button>
        }
        @if (o.status === 'shipped' || o.status === 'completed') {
          <button (click)="refundDialog.showModal()">Refund order</button>
        }
      </div>
      <section class="panel table-wrap">
        <h2>Items</h2>
        <table>
          <thead>
            <tr>
              <th>Product / variant</th>
              <th>Quantity</th>
              <th>Unit price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            @for (i of o.items; track i.variantId) {
              <tr>
                <td>
                  {{ i.name }}<small>{{ i.sku }} · {{ i.variantLabel }}</small>
                </td>
                <td>{{ i.quantity }}</td>
                <td>{{ money(i.unitPrice, o) }}</td>
                <td>{{ money(i.lineTotal, o) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </section>
      <div class="grid">
        <section class="panel">
          <h2>Customer</h2>
          <a [routerLink]="['/admin/customers', o.customer.id]">{{ o.customer.name }}</a>
          <p>{{ o.customer.email }}</p>
          <h2>Shipping address</h2>
          <p>
            {{ o.shippingAddress.fullName }}<br />{{ o.shippingAddress.line1 }}
            {{ o.shippingAddress.line2 }}<br />{{ o.shippingAddress.city }},
            {{ o.shippingAddress.region }} {{ o.shippingAddress.postalCode }}<br />{{
              o.shippingAddress.country
            }}
            · {{ o.shippingAddress.phone }}
          </p>
          <p>{{ o.shippingMethod.label }}</p>
          @if (o.tracking) {
            <p>Carrier: {{ o.tracking.carrier }}<br />Tracking: {{ o.tracking.number }}</p>
          }
        </section>
        <section class="panel">
          <h2>Payment</h2>
          <p>
            {{ o.payment.method }} · {{ o.payment.status }}
            {{ o.payment.last4 ? 'ending ' + o.payment.last4 : '' }}
          </p>
          <p>Subtotal {{ money(o.totals.subtotal, o) }}</p>
          <p>Discount −{{ money(o.totals.discount, o) }}</p>
          <p>Shipping {{ money(o.totals.shipping, o) }}</p>
          <p>Tax {{ money(o.totals.tax, o) }}</p>
          <strong>Total {{ money(o.totals.total, o) }}</strong>
        </section>
        <section class="panel">
          <h2>Timeline</h2>
          <ol>
            @for (h of o.statusHistory; track $index) {
              <li>
                <strong>{{ h.status }}</strong>
                <p>{{ date(h.at) }} · {{ h.by }} {{ h.note }}</p>
              </li>
            }
          </ol>
        </section>
        <section class="panel">
          <h2>Internal notes</h2>
          @for (n of o.internalNotes; track $index) {
            <p>
              {{ n.text }}<small> — {{ date(n.at) }}</small>
            </p>
          } @empty {
            <p>No notes yet. Notes are visible only to administrators.</p>
          }
          <form [formGroup]="notes" (ngSubmit)="addNote()">
            <label>Internal note<textarea formControlName="text" required></textarea></label
            ><button [disabled]="state.busy()">Add note</button>
          </form>
        </section>
      </div>
    }
    <dialog #shipDialog aria-labelledby="ship-title">
      <h2 id="ship-title">Ship order</h2>
      <form [formGroup]="shipping" (ngSubmit)="ship()">
        <label>Carrier<input formControlName="carrier" required /></label
        ><label>Tracking number<input formControlName="number" required /></label
        ><label>Shipment note<input formControlName="note" /></label
        ><adm-feedback [error]="state.error()" /><button class="primary" [disabled]="state.busy()">
          Confirm shipment</button
        ><button type="button" (click)="shipDialog.close()">Close</button>
      </form>
    </dialog>
    <dialog #refundDialog aria-labelledby="refund-title">
      <h2 id="refund-title">Refund order</h2>
      <p>Refund the full order amount. Stock is restored only when selected.</p>
      <form [formGroup]="refund" (ngSubmit)="refundOrder()">
        <label class="check"
          ><input type="checkbox" formControlName="restock" />Restock all items</label
        ><adm-feedback [error]="state.error()" /><button class="primary" [disabled]="state.busy()">
          Confirm refund</button
        ><button type="button" (click)="refundDialog.close()">Close</button>
      </form>
    </dialog>
    <adm-confirm />`,
})
export class OrderDetailComponent {
  readonly api = inject(AdminApi);
  readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';
  readonly state = new AdminState<AdminOrder>();
  readonly settings = inject(SettingsStore);
  readonly fb = inject(NonNullableFormBuilder);
  readonly shipping = this.fb.group({
    carrier: ['', Validators.required.bind(Validators)],
    number: ['', Validators.required.bind(Validators)],
    note: '',
  });
  readonly notes = this.fb.group({ text: ['', Validators.required.bind(Validators)] });
  readonly refund = this.fb.group({ restock: false });
  readonly confirm = viewChild.required(AdminConfirmComponent);
  readonly shipDialog = viewChild.required<ElementRef<HTMLDialogElement>>('shipDialog');
  readonly refundDialog = viewChild.required<ElementRef<HTMLDialogElement>>('refundDialog');
  constructor() {
    void this.load();
  }
  async load() {
    await this.state.load(() => this.api.get<AdminOrder>(`/orders/${this.id}`));
  }
  money(v: number, o: AdminOrder) {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: o.currency.code,
      minimumFractionDigits: o.currency.decimals,
    }).format(v / 10 ** o.currency.decimals);
  }
  date(v: string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(v),
    );
  }
  async change(status: string) {
    if (
      await this.confirm().ask(
        `${status} ${this.state.data()?.orderNumber}`,
        status === 'cancelled'
          ? 'Stock and discount usage will be restored. Paid orders are refunded.'
          : 'This action updates the order timeline.',
      )
    )
      if (
        await this.state.mutate(
          () => this.api.patch(`/orders/${this.id}/status`, { status }),
          'Order updated.',
        )
      )
        await this.load();
  }
  async ship() {
    if (this.shipping.invalid) {
      this.state.error.set('Carrier and tracking number are required.');
      return;
    }
    const { carrier, number, note } = this.shipping.getRawValue();
    if (
      await this.state.mutate(
        () =>
          this.api.patch(`/orders/${this.id}/status`, {
            status: 'shipped',
            tracking: { carrier, number },
            note,
          }),
        'Shipment recorded.',
      )
    ) {
      this.shipDialog().nativeElement.close();
      await this.load();
    }
  }
  async refundOrder() {
    if (
      await this.state.mutate(
        () => this.api.post(`/orders/${this.id}/refund`, this.refund.getRawValue()),
        'Order refunded.',
      )
    ) {
      this.refundDialog().nativeElement.close();
      await this.load();
    }
  }
  async addNote() {
    if (this.notes.invalid) return;
    if (
      await this.state.mutate(
        () => this.api.post(`/orders/${this.id}/notes`, this.notes.getRawValue()),
        'Note added.',
      )
    ) {
      this.notes.reset();
      await this.load();
    }
  }
}
