import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthStore } from '@web/core/auth-session';
import { SettingsStore } from '@web/core/settings-store';
import { errorMessage } from '@web/core/api-error';

@Component({
  selector: 'app-auth-page',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="auth-page">
      <a class="brand" routerLink="/">{{ settings.data()?.store?.name ?? 'CommerceOS' }}</a>
      <p class="eyebrow">Your account</p>
      <h1>{{ title() }}</h1>
      <form #authForm="ngForm" (ngSubmit)="submit()">
        @if (mode === 'register') {
          <label
            >First name
            <input
              name="firstName"
              [(ngModel)]="firstName"
              #firstNameField="ngModel"
              required
              minlength="2"
              autocomplete="given-name"
          /></label>
          @if (firstNameField.invalid && (firstNameField.touched || submitted())) {
            <p class="field-error" role="alert">Enter your first name (at least 2 characters).</p>
          }
          <label
            >Last name
            <input
              name="lastName"
              [(ngModel)]="lastName"
              #lastNameField="ngModel"
              required
              minlength="2"
              autocomplete="family-name"
          /></label>
          @if (lastNameField.invalid && (lastNameField.touched || submitted())) {
            <p class="field-error" role="alert">Enter your last name (at least 2 characters).</p>
          }
        }
        @if (mode !== 'reset-password') {
          <label
            >Email
            <input
              name="email"
              type="email"
              [(ngModel)]="email"
              #emailField="ngModel"
              required
              email
              autocomplete="email"
          /></label>
          @if (emailField.invalid && (emailField.touched || submitted())) {
            <p class="field-error" role="alert">Enter a valid email address.</p>
          }
        }
        @if (mode !== 'forgot-password') {
          <label
            >Password
            <input
              name="password"
              type="password"
              [(ngModel)]="password"
              #passwordField="ngModel"
              required
              [minlength]="mode === 'login' ? 1 : 8"
              [autocomplete]="mode === 'login' ? 'current-password' : 'new-password'"
          /></label>
          @if (passwordField.invalid && (passwordField.touched || submitted())) {
            <p class="field-error" role="alert">
              {{
                mode === 'login'
                  ? 'Enter your password.'
                  : 'Use at least 8 characters, with uppercase, lowercase and a number.'
              }}
            </p>
          }
        }
        @if (error()) {
          <p role="alert">{{ error() }}</p>
        }
        @if (notice()) {
          <p role="status">{{ notice() }}</p>
        }
        <button type="submit" [disabled]="busy() || authForm.invalid">
          {{ busy() ? 'Please wait…' : title() }}
        </button>
      </form>
      <nav aria-label="Account help">
        @if (mode !== 'login') {
          <a routerLink="/login">Login</a>
        }
        @if (mode !== 'register') {
          <a routerLink="/register">Create an account</a>
        }
        @if (mode === 'login') {
          <a routerLink="/forgot-password">Forgot password?</a>
        }
      </nav>
    </main>
  `,
  styleUrl: './auth-page.component.scss',
})
export class AuthPageComponent {
  private readonly session = inject(AuthStore);
  readonly settings = inject(SettingsStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly mode = this.route.snapshot.routeConfig?.path?.split('/')[0] ?? 'login';
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly submitted = signal(false);
  email = '';
  password = '';
  firstName = '';
  lastName = '';
  constructor() {
    void this.settings.load();
  }

  title(): string {
    return (
      (
        {
          login: 'Login',
          register: 'Register',
          'forgot-password': 'Forgot password',
          'reset-password': 'Reset password',
        } as Record<string, string>
      )[this.mode] ?? 'Login'
    );
  }

  private destination(): string {
    const url = this.route.snapshot.queryParamMap.get('returnUrl');
    return url?.startsWith('/') && !url.startsWith('//') ? url : '/account';
  }

  async submit(): Promise<void> {
    this.submitted.set(true);
    this.busy.set(true);
    this.error.set('');
    try {
      if (this.mode === 'register') {
        await this.session.register({
          email: this.email,
          password: this.password,
          firstName: this.firstName,
          lastName: this.lastName,
        });
        await this.router.navigateByUrl(this.destination());
      } else if (this.mode === 'forgot-password') {
        await this.session.forgotPassword(this.email);
        this.notice.set('If the account exists, a reset link was sent.');
      } else if (this.mode === 'reset-password') {
        await this.session.resetPassword(
          this.route.snapshot.paramMap.get('token') ?? '',
          this.password,
        );
        await this.router.navigateByUrl('/login');
      } else {
        await this.session.login({ email: this.email, password: this.password });
        await this.router.navigateByUrl(this.destination());
      }
    } catch (error) {
      this.error.set(
        errorMessage(
          error,
          'The request could not be completed. Please check your details and try again.',
        ),
      );
    } finally {
      this.busy.set(false);
    }
  }
}
