import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { AdminSettings } from '@commerceos/shared';
import { AdminApi } from './admin.api';
import { AdminState } from './admin-state';
import { AdminFeedbackComponent } from './admin-feedback.component';
import { SettingsStore } from '@web/core/settings-store';
@Component({
  selector: 'adm-settings',
  imports: [ReactiveFormsModule, AdminFeedbackComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './admin-page.scss',
  templateUrl: './settings.component.html',
})
export class SettingsComponent {
  readonly api = inject(AdminApi);
  readonly settings = inject(SettingsStore);
  readonly state = new AdminState<AdminSettings>();
  readonly fb = inject(NonNullableFormBuilder);
  readonly ready = signal(false);
  private baseline = '';
  readonly form = this.fb.group({
    name: ['', Validators.required.bind(Validators)],
    tagline: '',
    logoUrl: '',
    supportEmail: ['', Validators.email.bind(Validators)],
    phone: '',
    address: '',
    announcement: '',
    currencyCode: 'USD',
    currencySymbol: '$',
    decimals: 2,
    taxRate: 8,
    lowStockThreshold: 5,
    primary: '#0e1116',
    accent: '#b08d57',
    orderNumberPrefix: 'HLD',
    reviews: false,
    wishlist: true,
    methods: this.fb.array([this.method()]),
    valueProps: this.fb.array([this.fb.group({ title: '', text: '' })]),
  });
  constructor() {
    void this.load();
  }
  ngOnDestroy() {
    const theme = this.settings.data()?.theme;
    if (theme) {
      document.documentElement.style.setProperty('--color-ink', theme.primary);
      document.documentElement.style.setProperty('--color-accent', theme.accent);
    }
  }
  method(v?: AdminSettings['shipping']['methods'][number]) {
    return this.fb.group({
      code: v?.code ?? '',
      label: v?.label ?? '',
      price: v?.price ?? 0,
      freeOverSubtotal: v?.freeOverSubtotal === undefined ? '' : String(v.freeOverSubtotal),
      estimatedDays: v?.estimatedDays ?? 3,
      isActive: v?.isActive ?? true,
    });
  }
  async load() {
    this.ready.set(false);
    await this.state.load(() => this.api.get<AdminSettings>('/settings'));
    const s = this.state.data();
    if (!s) return;
    this.form.patchValue({
      name: s.store.name,
      tagline: s.store.tagline,
      logoUrl: s.store.logoUrl,
      supportEmail: s.store.supportEmail,
      phone: s.store.phone,
      address: s.store.address,
      announcement: s.store.announcement,
      currencyCode: s.currency.code,
      currencySymbol: s.currency.symbol,
      decimals: s.currency.decimals,
      taxRate: s.tax.ratePercent,
      lowStockThreshold: s.inventory.lowStockThreshold,
      primary: s.theme.primary,
      accent: s.theme.accent,
      orderNumberPrefix: s.orderNumberPrefix,
      reviews: s.features.reviews,
      wishlist: s.features.wishlist,
    });
    this.form.controls.methods.clear();
    s.shipping.methods.forEach((m) => this.form.controls.methods.push(this.method(m)));
    this.form.controls.valueProps.clear();
    s.store.valueProps.forEach((p) => this.form.controls.valueProps.push(this.fb.group(p)));
    this.baseline = JSON.stringify(this.form.getRawValue());
    this.ready.set(true);
  }
  hasUnsavedChanges() {
    return this.ready() && this.baseline !== JSON.stringify(this.form.getRawValue());
  }
  preview() {
    document.documentElement.style.setProperty('--color-ink', this.form.controls.primary.value);
    document.documentElement.style.setProperty('--color-accent', this.form.controls.accent.value);
  }
  async upload(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f)
      await this.state.mutate(async () => {
        this.form.controls.logoUrl.setValue((await this.api.upload([f])).data[0]?.url ?? '');
      }, 'Logo uploaded. Save settings to apply it.');
  }
  async save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.state.error.set('Enter a store name and a valid support email.');
      return;
    }
    const v = this.form.getRawValue();
    const payload: AdminSettings = {
      store: {
        name: v.name,
        tagline: v.tagline,
        logoUrl: v.logoUrl,
        supportEmail: v.supportEmail,
        phone: v.phone,
        address: v.address,
        announcement: v.announcement,
        valueProps: v.valueProps,
      },
      currency: { code: v.currencyCode, symbol: v.currencySymbol, decimals: v.decimals },
      tax: { ratePercent: v.taxRate, inclusive: false },
      inventory: { lowStockThreshold: v.lowStockThreshold },
      theme: { primary: v.primary, accent: v.accent },
      orderNumberPrefix: v.orderNumberPrefix,
      features: { reviews: v.reviews, wishlist: v.wishlist },
      shipping: {
        methods: v.methods.map((m) => ({
          code: m.code,
          label: m.label,
          price: m.price,
          ...(m.freeOverSubtotal === '' ? {} : { freeOverSubtotal: Number(m.freeOverSubtotal) }),
          estimatedDays: m.estimatedDays,
          isActive: m.isActive,
        })),
      },
    };
    if (
      await this.state.mutate(async () => {
        await this.api.put('/settings', payload);
        await this.settings.load();
        this.baseline = JSON.stringify(v);
      }, 'Settings saved. The storefront now uses your brand.')
    ) {
      this.baseline = JSON.stringify(v);
    }
  }
}
