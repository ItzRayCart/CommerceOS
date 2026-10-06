import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import type { CheckoutInput, OrderInput } from '@commerceos/shared';
import { AccountApi, type AddressView } from '@web/auth/account.api';
import { AuthStore } from '@web/core/auth-session';
import { SettingsStore } from '@web/core/settings-store';
import { errorMessage } from '@web/core/api-error';
import { CartStore } from '@web/features/cart/cart.store';
import { CheckoutStore } from './checkout.store';
import { tokenizeMockCard } from './mock-payment';

@Component({
  selector: 'app-checkout-page',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './checkout-page.component.html',
  styleUrl: './checkout-page.component.scss',
})
export class CheckoutPageComponent {
  readonly checkout = inject(CheckoutStore);
  readonly settings = inject(SettingsStore);
  readonly cart = inject(CartStore);
  private readonly account = inject(AccountApi);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  readonly step = signal(0);
  readonly addressErrors = computed(() =>
    Object.fromEntries(
      this.checkout
        .fieldErrors()
        .map((entry) => [entry.path.replace(/^address\./, ''), entry.message]),
    ),
  );
  readonly steps = ['Address', 'Shipping', 'Payment', 'Review'];
  readonly addresses = signal<AddressView[]>([]);
  readonly selectedAddress = signal('new');
  readonly shipping = signal('');
  readonly method = signal<'card_mock' | 'cod'>('card_mock');
  readonly loading = signal(true);
  readonly error = signal('');
  private payment: OrderInput['payment'] | null = null;
  readonly addressFields = [
    { key: 'fullName', label: 'Full name', autocomplete: 'name' },
    { key: 'line1', label: 'Street address', autocomplete: 'address-line1' },
    { key: 'line2', label: 'Apartment or suite (optional)', autocomplete: 'address-line2' },
    { key: 'city', label: 'City', autocomplete: 'address-level2' },
    { key: 'region', label: 'State or region', autocomplete: 'address-level1' },
    { key: 'postalCode', label: 'Postal code', autocomplete: 'postal-code' },
    { key: 'country', label: 'Country code (two letters)', autocomplete: 'country' },
    { key: 'phone', label: 'Phone with country code', autocomplete: 'tel' },
  ] as const;
  readonly addressForm = this.fb.nonNullable.group({
    fullName: ['', [Validators.required.bind(Validators), Validators.maxLength(120)]],
    line1: ['', [Validators.required.bind(Validators), Validators.maxLength(200)]],
    line2: ['', Validators.maxLength(200)],
    city: ['', [Validators.required.bind(Validators), Validators.maxLength(100)]],
    region: ['', [Validators.required.bind(Validators), Validators.maxLength(100)]],
    postalCode: ['', [Validators.required.bind(Validators), Validators.maxLength(30)]],
    country: ['', [Validators.required.bind(Validators), Validators.pattern(/^[a-z]{2}$/i)]],
    phone: ['', [Validators.required.bind(Validators), Validators.pattern(/^\+?[1-9]\d{6,14}$/)]],
  });
  readonly cardForm = this.fb.nonNullable.group({ number: [''], expiry: [''], cvc: [''] });
  constructor() {
    inject(Title).setTitle('Checkout');
    this.checkout.restore();
    void this.load();
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      await this.cart.readyForCheckout();
      await this.settings.load();
      if (!this.settings.data()) throw new Error('Store settings are unavailable. Please retry.');
      const result = await firstValueFrom(this.account.addresses());
      this.addresses.set(result.data);
      this.selectedAddress.set(result.data.find((address) => address.isDefault)?.id ?? 'new');
      this.shipping.set(this.settings.data()?.shipping.methods[0]?.code ?? '');
      const user = this.auth.user();
      this.addressForm.patchValue({
        fullName: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
        phone: user?.phone ?? '',
      });
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
  private input(): CheckoutInput | null {
    if (this.selectedAddress() === 'new') {
      this.addressForm.markAllAsTouched();
      if (this.addressForm.invalid) {
        this.error.set('Complete the highlighted address fields.');
        return null;
      }
      return { address: this.addressForm.getRawValue(), shippingMethodCode: this.shipping() };
    }
    return { addressId: this.selectedAddress(), shippingMethodCode: this.shipping() };
  }
  async next() {
    this.error.set('');
    const input = this.input();
    if (!input) return;
    if (this.step() === 2) {
      try {
        this.payment =
          this.method() === 'cod'
            ? { method: 'cod' }
            : tokenizeMockCard(
                this.cardForm.controls.number.value,
                this.cardForm.controls.expiry.value,
                this.cardForm.controls.cvc.value,
              );
      } catch (error) {
        this.error.set(error instanceof Error ? error.message : errorMessage(error));
        return;
      }
    }
    if (await this.checkout.refresh(input)) {
      if (this.step() === 2) this.cardForm.reset();
      this.step.update((step) => Math.min(step + 1, 3));
      this.focusHeading();
    } else {
      this.applyFieldErrors();
    }
  }
  edit(step: number) {
    if (!this.checkout.pending() && !this.checkout.busy()) {
      this.step.set(step);
      this.error.set('');
      this.focusHeading();
    }
  }
  async refreshReview() {
    const input = this.input();
    if (input) {
      await this.checkout.refresh(input);
      this.applyFieldErrors();
    }
  }
  async place() {
    const input = this.checkout.pending() ? undefined : this.input();
    if (!this.checkout.pending() && (!input || !this.payment || !this.checkout.quote())) return;
    const result = await this.checkout.submit(
      input
        ? { ...input, payment: this.payment!, quoteFingerprint: this.checkout.quote()!.fingerprint }
        : undefined,
    );
    if (result) {
      this.payment = null;
      this.cardForm.reset();
      await this.cart.load();
      await this.router.navigate(['/checkout/success', result.orderNumber]);
    } else {
      this.applyFieldErrors();
    }
  }
  private applyFieldErrors() {
    for (const issue of this.checkout.fieldErrors()) {
      const field = this.addressFields.find((entry) => issue.path === `address.${entry.key}`);
      if (field) {
        const control = this.addressForm.controls[field.key];
        control.setErrors({ ...control.errors, server: issue.message });
        control.markAsTouched();
        this.step.set(0);
      }
    }
  }
  private focusHeading() {
    queueMicrotask(() => document.getElementById('checkout-step-title')?.focus());
  }
}
