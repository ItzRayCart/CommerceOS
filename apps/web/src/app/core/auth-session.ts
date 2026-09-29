import { HttpBackend, HttpClient, HttpErrorResponse } from '@angular/common/http';
import type { HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { CanActivateFn } from '@angular/router';
import { firstValueFrom, from, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import type { ApiEnvelope } from '@commerceos/shared';

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: 'customer' | 'admin';
  status: 'active' | 'disabled';
}
interface SessionResponse {
  accessToken: string;
  user: SessionUser;
}

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly http = new HttpClient(inject(HttpBackend));
  private readonly router = inject(Router);
  readonly user = signal<SessionUser | null>(null);
  private accessToken: string | null = null;
  private refreshInFlight: Promise<string | null> | null = null;

  token(): string | null {
    return this.accessToken;
  }

  private accept(session: SessionResponse): string {
    this.accessToken = session.accessToken;
    this.user.set(session.user);
    return session.accessToken;
  }

  private clear(): void {
    this.accessToken = null;
    this.user.set(null);
  }

  redirectToLogin(): void {
    this.clear();
    void this.router.navigateByUrl(`/login?returnUrl=${encodeURIComponent(this.router.url)}`);
  }

  async register(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<void> {
    const result = await firstValueFrom(
      this.http.post<ApiEnvelope<SessionResponse>>('/api/v1/auth/register', input, {
        withCredentials: true,
      }),
    );
    this.accept(result.data);
  }

  async login(input: { email: string; password: string }): Promise<void> {
    const result = await firstValueFrom(
      this.http.post<ApiEnvelope<SessionResponse>>('/api/v1/auth/login', input, {
        withCredentials: true,
      }),
    );
    this.accept(result.data);
  }

  refresh(): Promise<string | null> {
    if (this.refreshInFlight) return this.refreshInFlight;
    const pending = firstValueFrom(
      this.http.post<ApiEnvelope<SessionResponse>>(
        '/api/v1/auth/refresh',
        {},
        { withCredentials: true },
      ),
    )
      .then((result) => this.accept(result.data))
      .catch(() => {
        this.clear();
        return null;
      })
      .finally(() => {
        this.refreshInFlight = null;
      });
    this.refreshInFlight = pending;
    return pending;
  }

  async logout(): Promise<void> {
    const revoke = (token: string) =>
      firstValueFrom(
        this.http.post(
          '/api/v1/auth/logout',
          {},
          {
            withCredentials: true,
            headers: { Authorization: `Bearer ${token}` },
          },
        ),
      );
    try {
      const token = this.accessToken ?? (await this.refresh());
      if (!token) return;
      try {
        await revoke(token);
      } catch (error) {
        if (
          !(error instanceof HttpErrorResponse) ||
          error.status !== 401 ||
          !isTokenExpired(error.error as unknown)
        )
          throw error;
        const fresh = await this.refresh();
        if (fresh) await revoke(fresh);
      }
    } finally {
      this.clear();
      await this.router.navigateByUrl('/login');
    }
  }

  async forgotPassword(email: string): Promise<void> {
    await firstValueFrom(this.http.post('/api/v1/auth/forgot-password', { email }));
  }

  async resetPassword(token: string, password: string): Promise<void> {
    await firstValueFrom(this.http.post('/api/v1/auth/reset-password', { token, password }));
  }
}

export function authInterceptor(request: HttpRequest<unknown>, next: HttpHandlerFn) {
  const session = inject(AuthStore);
  if (
    !request.url.startsWith('/api/v1') ||
    (request.url.startsWith('/api/v1/auth/') && request.url !== '/api/v1/auth/me')
  )
    return next(request);
  const token = session.token();
  const authenticated = token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;
  return next(authenticated).pipe(
    catchError((error: unknown) => {
      if (
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        !isTokenExpired(error.error as unknown)
      ) {
        return throwError(() => error);
      }
      return from(session.refresh()).pipe(
        switchMap((fresh) => {
          if (fresh)
            return next(request.clone({ setHeaders: { Authorization: `Bearer ${fresh}` } }));
          session.redirectToLogin();
          return throwError(() => error);
        }),
      );
    }),
  );
}

function isTokenExpired(body: unknown): boolean {
  if (typeof body !== 'object' || body === null || !('error' in body)) return false;
  const detail: unknown = body.error;
  return (
    typeof detail === 'object' &&
    detail !== null &&
    'code' in detail &&
    detail.code === 'TOKEN_EXPIRED'
  );
}

export const authGuard: CanActivateFn = async (_route, state) => {
  const session = inject(AuthStore);
  const router = inject(Router);
  if (session.user() || (await session.refresh())) return true;
  return router.parseUrl(`/login?returnUrl=${encodeURIComponent(state.url)}`);
};

type Permission = 'read-own-account' | 'admin';
const permissions: Record<SessionUser['role'], readonly Permission[]> = {
  customer: ['read-own-account'],
  admin: ['read-own-account', 'admin'],
};
export function can(role: SessionUser['role'], permission: Permission): boolean {
  return permissions[role].includes(permission);
}

export const adminGuard: CanActivateFn = async (_route, state) => {
  const session = inject(AuthStore);
  const router = inject(Router);
  if (!session.user()) await session.refresh();
  const role = session.user()?.role;
  if (role && can(role, 'admin')) return true;
  return router.parseUrl(role ? '/' : `/login?returnUrl=${encodeURIComponent(state.url)}`);
};

export const guestGuard: CanActivateFn = () => {
  const session = inject(AuthStore);
  const router = inject(Router);
  return session.user() ? router.parseUrl('/account') : true;
};
