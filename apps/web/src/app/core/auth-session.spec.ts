import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthStore, adminGuard, authInterceptor } from '@web/core/auth-session';

const user = {
  id: '507f1f77bcf86cd799439011',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'Customer',
  role: 'customer',
  status: 'active',
};

describe('AuthStore', () => {
  let session: AuthStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    session = TestBed.inject(AuthStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('shares one refresh request and keeps the access token in memory', async () => {
    const first = session.refresh();
    const second = session.refresh();
    expect(first).toBe(second);
    const refresh = http.expectOne('/api/v1/auth/refresh');
    expect(refresh.request.withCredentials).toBe(true);
    refresh.flush({ data: { accessToken: 'fresh-token', user } });
    expect(await first).toBe('fresh-token');
    expect(session.token()).toBe('fresh-token');
    expect(session.user()?.email).toBe(user.email);
  });

  it('refreshes once on TOKEN_EXPIRED and retries the protected request once', async () => {
    const login = session.login({ email: user.email, password: 'ExamplePassword9' });
    http.expectOne('/api/v1/auth/login').flush({ data: { accessToken: 'old-token', user } });
    await login;

    const api = TestBed.inject(HttpClient);
    const result = firstValueFrom(api.get('/api/v1/auth/me'));
    const original = http.expectOne('/api/v1/auth/me');
    expect(original.request.headers.get('Authorization')).toBe('Bearer old-token');
    original.flush(
      { error: { code: 'TOKEN_EXPIRED' } },
      { status: 401, statusText: 'Unauthorized' },
    );
    http.expectOne('/api/v1/auth/refresh').flush({ data: { accessToken: 'new-token', user } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const retried = http.expectOne('/api/v1/auth/me');
    expect(retried.request.headers.get('Authorization')).toBe('Bearer new-token');
    retried.flush({ data: user });
    expect(await result).toEqual({ data: user });
  });

  it('redirects a customer away from the admin route without requesting admin data', async () => {
    session.user.set({ ...user, role: 'customer', status: 'active' });
    const outcome = await TestBed.runInInjectionContext(() =>
      adminGuard({} as ActivatedRouteSnapshot, { url: '/admin' } as RouterStateSnapshot),
    );
    expect(outcome instanceof UrlTree).toBe(true);
    expect(TestBed.inject(Router).serializeUrl(outcome as UrlTree)).toBe('/');
    http.expectNone('/api/v1/admin/auth/check');
  });
});
