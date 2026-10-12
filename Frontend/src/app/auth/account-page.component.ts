import { Title } from '@angular/platform-browser';
import { SettingsStore } from '@web/core/settings-store';
import type { AbstractControl } from '@angular/forms';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import type { OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AccountApi } from '@web/auth/account.api';
import type { AddressView } from '@web/auth/account.api';
import { AuthStore } from '@web/core/auth-session';
import { errorMessage, getApiError } from '@web/core/api-error';

const required = (control: AbstractControl) => Validators.required(control);

const nonBlank = (control: AbstractControl) =>
  typeof control.value === 'string' && !control.value.trim() ? { required: true } : null;

@Component({
  selector: 'app-account-page',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './account-page.component.html',
  styleUrl: './account-page.component.scss',
})
export class AccountPageComponent implements OnInit {
  readonly session = inject(AuthStore);
  readonly settings = inject(SettingsStore);
  private readonly title = inject(Title);
  private readonly api = inject(AccountApi);
  private readonly fb = inject(FormBuilder).nonNullable;
  readonly route = inject(ActivatedRoute);
  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly tab = computed(() =>
    this.query().get('tab') === 'security'
      ? 'security'
      : this.route.snapshot.data['tab'] === 'addresses'
        ? 'addresses'
        : 'profile',
  );
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly busy = signal(false);
  readonly actionError = signal('');
  readonly notice = signal('');
  readonly addresses = signal<AddressView[]>([]);
  readonly editingAddress = signal<string | null>(null);
  readonly addressFormOpen = signal(false);
  readonly pendingRemoval = signal<AddressView | null>(null);
  readonly profile = this.fb.group({
    firstName: ['', [required, nonBlank, Validators.maxLength(60)]],
    lastName: ['', [required, nonBlank, Validators.maxLength(60)]],
    phone: ['', Validators.pattern(/^\+?[1-9]\d{6,14}$/)],
  });
  readonly password = this.fb.group(
    {
      currentPassword: ['', required],
      newPassword: [
        '',
        [
          required,
          Validators.minLength(8),
          Validators.maxLength(128),
          Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/),
        ],
      ],
      confirmPassword: ['', required],
    },
    {
      validators: (control: AbstractControl) => {
        const value: unknown = control.value;
        return value &&
          typeof value === 'object' &&
          'newPassword' in value &&
          'confirmPassword' in value &&
          value.newPassword !== value.confirmPassword
          ? { mismatch: true }
          : null;
      },
    },
  );
  readonly address = this.fb.group({
    label: ['', [required, nonBlank, Validators.maxLength(50)]],
    fullName: ['', [required, nonBlank, Validators.maxLength(120)]],
    line1: ['', [required, nonBlank, Validators.maxLength(200)]],
    line2: ['', Validators.maxLength(200)],
    city: ['', [required, nonBlank, Validators.maxLength(100)]],
    region: ['', [required, nonBlank, Validators.maxLength(100)]],
    postalCode: ['', [required, nonBlank, Validators.maxLength(30)]],
    country: ['', [required, Validators.pattern(/^[a-zA-Z]{2}$/)]],
    phone: ['', [required, nonBlank, Validators.maxLength(30)]],
    isDefault: [false],
  });

  constructor() {
    effect(() =>
      this.title.setTitle(`My account | ${this.settings.data()?.store.name ?? 'Store'}`),
    );
  }

  ngOnInit(): void {
    void this.load();
  }
  invalid(control: AbstractControl): boolean {
    return control.touched && control.invalid;
  }
  fieldMessage(control: AbstractControl, fallback: string): string {
    const server: unknown = control.errors?.['server'];
    if (typeof server === 'string') return server;
    const limit: unknown = control.errors?.['maxlength'];
    if (
      limit &&
      typeof limit === 'object' &&
      'requiredLength' in limit &&
      typeof limit.requiredLength === 'number'
    )
      return `Use ${limit.requiredLength} characters or fewer.`;
    return fallback;
  }

  async load(): Promise<void> {
    if (this.busy()) return;
    this.loading.set(true);
    this.loadError.set('');
    try {
      const [profile, addresses] = await Promise.all([
        firstValueFrom(this.api.me()),
        firstValueFrom(this.api.addresses()),
      ]);
      this.session.user.set(profile.data);
      this.profile.reset({
        firstName: profile.data.firstName,
        lastName: profile.data.lastName,
        phone: profile.data.phone ?? '',
      });
      this.addresses.set(addresses.data);
    } catch (error) {
      this.loadError.set(errorMessage(error, 'Could not load your account. Please try again.'));
    } finally {
      this.loading.set(false);
    }
  }

  async saveProfile(): Promise<void> {
    this.profile.markAllAsTouched();
    if (this.profile.invalid) return;
    const value = this.profile.getRawValue();
    await this.act(
      async () => {
        const response = await firstValueFrom(
          this.api.updateProfile({
            firstName: value.firstName.trim(),
            lastName: value.lastName.trim(),
            phone: value.phone.trim(),
          }),
        );
        this.session.user.set(response.data);
        this.profile.markAsPristine();
      },
      'Your profile has been saved.',
      this.profile,
    );
  }

  async savePassword(): Promise<void> {
    this.password.markAllAsTouched();
    if (this.password.invalid) return;
    const { currentPassword, newPassword } = this.password.getRawValue();
    await this.act(
      async () => {
        await firstValueFrom(this.api.changePassword({ currentPassword, newPassword }));
        this.password.reset();
        await this.session.logout();
      },
      'Password changed. Sign in again with your new password.',
      this.password,
    );
  }

  openAddress(saved?: AddressView): void {
    if (this.busy()) return;
    this.editingAddress.set(saved?.id ?? null);
    this.address.reset();
    if (saved) this.address.patchValue(saved);
    else
      this.address.patchValue({
        fullName:
          `${this.profile.controls.firstName.value} ${this.profile.controls.lastName.value}`.trim(),
        phone: this.profile.controls.phone.value,
        isDefault: this.addresses().length === 0,
      });
    this.addressFormOpen.set(true);
    this.actionError.set('');
  }

  async saveAddress(): Promise<void> {
    this.address.markAllAsTouched();
    if (this.address.invalid) return;
    const value = this.address.getRawValue();
    const id = this.editingAddress();
    await this.act(
      async () => {
        const body = { ...value, country: value.country.toUpperCase() };
        const saved = (
          await firstValueFrom(id ? this.api.updateAddress(id, body) : this.api.addAddress(body))
        ).data;
        this.addresses.update((items) => {
          const updated = saved.isDefault
            ? items.map((item) => ({ ...item, isDefault: false }))
            : items;
          return id ? updated.map((item) => (item.id === id ? saved : item)) : [...updated, saved];
        });
        this.addressFormOpen.set(false);
        this.address.reset();
      },
      id ? 'Address updated.' : 'Address added.',
      this.address,
    );
  }

  async makeDefault(id: string): Promise<void> {
    await this.act(async () => {
      await firstValueFrom(this.api.setDefault(id));
      this.addresses.update((items) =>
        items.map((item) => ({ ...item, isDefault: item.id === id })),
      );
    }, 'Default address updated.');
  }

  async removeAddress(dialog?: HTMLDialogElement): Promise<void> {
    const saved = this.pendingRemoval();
    if (!saved) return;
    await this.act(async () => {
      await firstValueFrom(this.api.deleteAddress(saved.id));
      this.addresses.update((items) => {
        const remaining = items.filter((item) => item.id !== saved.id);
        return saved.isDefault
          ? remaining.map((item, index) => ({ ...item, isDefault: index === 0 }))
          : remaining;
      });
      this.pendingRemoval.set(null);
      dialog?.close();
    }, 'Address removed.');
  }

  async logout(): Promise<void> {
    await this.act(() => this.session.logout(), 'You have signed out.');
  }

  private async act(
    action: () => Promise<void>,
    success: string,
    form?: AbstractControl,
  ): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.actionError.set('');
    this.notice.set('');
    try {
      await action();
      this.notice.set(success);
    } catch (error) {
      const details = getApiError(error).details;
      if (form && Array.isArray(details))
        for (const entry of details) {
          const detail: unknown = entry;
          if (
            detail &&
            typeof detail === 'object' &&
            'path' in detail &&
            'message' in detail &&
            typeof detail.path === 'string' &&
            typeof detail.message === 'string'
          ) {
            const field = form.get(detail.path.replace(/^body\./, ''));
            field?.setErrors({ server: detail.message });
            field?.markAsTouched();
          }
        }
      this.actionError.set(errorMessage(error, 'The change could not be saved. Please try again.'));
    } finally {
      this.busy.set(false);
    }
  }
}
