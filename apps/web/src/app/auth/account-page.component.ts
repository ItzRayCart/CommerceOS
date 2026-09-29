import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import type { OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AccountApi } from '@web/auth/account.api';
import type { AddressView } from '@web/auth/account.api';
import { AuthStore } from '@web/core/auth-session';

function emptyAddress() {
  return {
    label: '',
    fullName: '',
    line1: '',
    city: '',
    region: '',
    postalCode: '',
    country: '',
    phone: '',
    isDefault: false,
  };
}

@Component({
  selector: 'app-account-page',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="account">
      <header>
        <a routerLink="/">CommerceOS</a><button type="button" (click)="logout()">Logout</button>
      </header>
      <h1>My account</h1>
      @if (loading()) {
        <p role="status">Loading account…</p>
      }
      @if (loadError()) {
        <p role="alert">Could not load your account.</p>
        <button type="button" (click)="load()">Retry</button>
      }
      @if (!loading() && !loadError()) {
        @if (notice()) {
          <p role="status">{{ notice() }}</p>
        }
        @if (actionError()) {
          <p role="alert">{{ actionError() }}</p>
        }
        <section>
          <h2>Profile</h2>
          <form (ngSubmit)="saveProfile()">
            <label
              >First name <input name="firstName" [(ngModel)]="firstName" required maxlength="60"
            /></label>
            <label
              >Last name <input name="lastName" [(ngModel)]="lastName" required maxlength="60"
            /></label>
            <label>Phone <input name="phone" [(ngModel)]="phone" autocomplete="tel" /></label>
            <button type="submit" [disabled]="busy()">Save profile</button>
          </form>
        </section>
        <section>
          <h2>Change password</h2>
          <form (ngSubmit)="savePassword()">
            <label
              >Current password
              <input
                name="currentPassword"
                type="password"
                [(ngModel)]="currentPassword"
                required
                autocomplete="current-password"
            /></label>
            <label
              >New password
              <input
                name="newPassword"
                type="password"
                [(ngModel)]="newPassword"
                required
                minlength="8"
                autocomplete="new-password"
            /></label>
            <button type="submit" [disabled]="busy()">Change password</button>
          </form>
        </section>
        <section>
          <h2>Saved addresses</h2>
          @if (addresses().length === 0) {
            <p>No saved addresses yet.</p>
          }
          @for (address of addresses(); track address.id) {
            <article>
              <strong
                >{{ address.label }}
                @if (address.isDefault) {
                  (default)
                }
              </strong>
              <p>
                {{ address.fullName }} · {{ address.line1 }} · {{ address.city }},
                {{ address.region }} {{ address.postalCode }}
              </p>
              @if (!address.isDefault) {
                <button type="button" [disabled]="busy()" (click)="makeDefault(address.id)">
                  Make default
                </button>
              }
              <button type="button" [disabled]="busy()" (click)="removeAddress(address.id)">
                Remove
              </button>
            </article>
          }
          <h3>Add address</h3>
          <form (ngSubmit)="saveAddress()">
            <label>Label <input name="label" [(ngModel)]="draft.label" required /></label>
            <label>Full name <input name="fullName" [(ngModel)]="draft.fullName" required /></label>
            <label>Address line <input name="line1" [(ngModel)]="draft.line1" required /></label>
            <label>City <input name="city" [(ngModel)]="draft.city" required /></label>
            <label>Region <input name="region" [(ngModel)]="draft.region" required /></label>
            <label
              >Postal code <input name="postalCode" [(ngModel)]="draft.postalCode" required
            /></label>
            <label
              >Country code
              <input
                name="country"
                [(ngModel)]="draft.country"
                required
                maxlength="2"
                minlength="2"
            /></label>
            <label>Phone <input name="addressPhone" [(ngModel)]="draft.phone" required /></label>
            <label
              ><input name="isDefault" type="checkbox" [(ngModel)]="draft.isDefault" /> Make
              default</label
            >
            <button type="submit" [disabled]="busy() || addresses().length >= 10">
              Add address
            </button>
          </form>
        </section>
      }
    </main>
  `,
  styles: [
    `
      .account {
        max-width: 56rem;
        margin: 2rem auto;
        padding: 1.5rem;
      }
      header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      section {
        margin: 2rem 0;
        padding: 1.5rem;
        border: 1px solid var(--color-border);
      }
      form {
        display: grid;
        gap: 1rem;
        max-width: 30rem;
      }
      label {
        display: grid;
        gap: 0.35rem;
      }
      input,
      button {
        font: inherit;
        padding: 0.55rem;
      }
      article {
        padding: 1rem 0;
        border-bottom: 1px solid var(--color-border);
      }
      article button {
        margin-right: 0.5rem;
      }
      [role='alert'] {
        color: #9c1d1d;
      }
    `,
  ],
})
export class AccountPageComponent implements OnInit {
  readonly session = inject(AuthStore);
  private readonly api = inject(AccountApi);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly busy = signal(false);
  readonly actionError = signal('');
  readonly notice = signal('');
  readonly addresses = signal<AddressView[]>([]);
  firstName = '';
  lastName = '';
  phone = '';
  currentPassword = '';
  newPassword = '';
  draft = emptyAddress();

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(false);
    try {
      const [profile, addresses] = await Promise.all([
        firstValueFrom(this.api.me()),
        firstValueFrom(this.api.addresses()),
      ]);
      this.session.user.set(profile.data);
      this.firstName = profile.data.firstName;
      this.lastName = profile.data.lastName;
      this.phone = profile.data.phone ?? '';
      this.addresses.set(addresses.data);
    } catch {
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  async saveProfile(): Promise<void> {
    await this.act(async () => {
      const response = await firstValueFrom(
        this.api.updateProfile({
          firstName: this.firstName,
          lastName: this.lastName,
          ...(this.phone ? { phone: this.phone } : {}),
        }),
      );
      this.session.user.set(response.data);
    }, 'Profile saved.');
  }

  async savePassword(): Promise<void> {
    await this.act(async () => {
      await firstValueFrom(
        this.api.changePassword({
          currentPassword: this.currentPassword,
          newPassword: this.newPassword,
        }),
      );
      await this.session.logout();
    }, 'Password changed. Please log in again.');
  }

  async saveAddress(): Promise<void> {
    await this.act(async () => {
      await firstValueFrom(this.api.addAddress(this.draft));
      this.draft = emptyAddress();
      this.addresses.set((await firstValueFrom(this.api.addresses())).data);
    }, 'Address added.');
  }

  async makeDefault(id: string): Promise<void> {
    await this.act(async () => {
      await firstValueFrom(this.api.setDefault(id));
      this.addresses.set((await firstValueFrom(this.api.addresses())).data);
    }, 'Default address updated.');
  }

  async removeAddress(id: string): Promise<void> {
    await this.act(async () => {
      await firstValueFrom(this.api.deleteAddress(id));
      this.addresses.set((await firstValueFrom(this.api.addresses())).data);
    }, 'Address removed.');
  }

  async logout(): Promise<void> {
    try {
      await this.session.logout();
    } catch {
      this.actionError.set('Logout could not reach the server. Your local session was cleared.');
    }
  }

  private async act(action: () => Promise<void>, success: string): Promise<void> {
    this.busy.set(true);
    this.actionError.set('');
    this.notice.set('');
    try {
      await action();
      this.notice.set(success);
    } catch {
      this.actionError.set('The change could not be saved. Check the fields and try again.');
    } finally {
      this.busy.set(false);
    }
  }
}
