import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthStore } from '@web/core/auth-session';

@Component({
  selector: 'app-auth-page',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="auth-page">
      <a routerLink="/">CommerceOS</a>
      <h1>{{ title() }}</h1>
      <form (ngSubmit)="submit()">
        @if (mode === 'register') {
          <label
            >First name
            <input name="firstName" [(ngModel)]="firstName" required autocomplete="given-name"
          /></label>
          <label
            >Last name
            <input name="lastName" [(ngModel)]="lastName" required autocomplete="family-name"
          /></label>
        }
        @if (mode !== 'reset-password') {
          <label
            >Email
            <input name="email" type="email" [(ngModel)]="email" required autocomplete="email"
          /></label>
        }
        @if (mode !== 'forgot-password') {
          <label
            >Password
            <input
              name="password"
              type="password"
              [(ngModel)]="password"
              required
              [autocomplete]="mode === 'login' ? 'current-password' : 'new-password'"
          /></label>
        }
        @if (error()) {
          <p role="alert">{{ error() }}</p>
        }
        @if (notice()) {
          <p role="status">{{ notice() }}</p>
        }
        <button type="submit" [disabled]="busy()">{{ busy() ? 'Please wait…' : title() }}</button>
      </form>
      <nav>
        <a routerLink="/login">Login</a> · <a routerLink="/register">Register</a> ·
        <a routerLink="/forgot-password">Forgot password?</a>
      </nav>
    </main>
  `,
  styles: [
    `
      .auth-page {
        max-width: 28rem;
        margin: 4rem auto;
        padding: 1.5rem;
      }
      form,
      label {
        display: grid;
        gap: 0.5rem;
      }
      form {
        gap: 1.25rem;
      }
      input,
      button {
        font: inherit;
        padding: 0.75rem;
      }
      nav {
        margin-top: 1.5rem;
      }
      [role='alert'] {
        color: #9c1d1d;
      }
    `,
  ],
})
export class AuthPageComponent {
  private readonly session = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly mode = this.route.snapshot.routeConfig?.path?.split('/')[0] ?? 'login';
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  email = '';
  password = '';
  firstName = '';
  lastName = '';

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
    } catch {
      this.error.set(
        'The request could not be completed. Please check your details and try again.',
      );
    } finally {
      this.busy.set(false);
    }
  }
}
