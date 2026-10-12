import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { AuthStore } from '@web/core/auth-session';
import { AccountPageComponent } from './account-page.component';

const user = {
  id: 'customer',
  email: 'test@example.com',
  firstName: 'Avery',
  lastName: 'Gray',
  role: 'customer',
  status: 'active',
} as const;
const saved = {
  id: 'address-id',
  label: 'Home',
  fullName: 'Avery Gray',
  line1: '12 Main Street',
  line2: '',
  city: 'Boston',
  region: 'MA',
  postalCode: '02108',
  country: 'US',
  phone: '+16175550100',
  isDefault: true,
};

describe('account forms', () => {
  let page: AccountPageComponent;
  let http: HttpTestingController;
  const logout = vi.fn(() => Promise.resolve());
  beforeEach(async () => {
    logout.mockClear();
    TestBed.configureTestingModule({
      imports: [AccountPageComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthStore, useValue: { user: signal(user), logout } },
      ],
    });
    const fixture = TestBed.createComponent(AccountPageComponent);
    page = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/v1/auth/me').flush({ data: user });
    http.expectOne('/api/v1/me/addresses').flush({ data: [] });
    await fixture.whenStable();
  });
  afterEach(() => http.verify());

  it('rejects whitespace names and invalid phone numbers before sending', async () => {
    page.profile.patchValue({ firstName: '   ', phone: 'invalid' });
    await page.saveProfile();
    expect(page.invalid(page.profile.controls.firstName)).toBe(true);
    expect(page.invalid(page.profile.controls.phone)).toBe(true);
    http.expectNone('/api/v1/me');
  });

  it('maps server validation to the field and prevents duplicate saves', async () => {
    page.profile.controls.firstName.setValue('Taylor');
    const first = page.saveProfile();
    await page.saveProfile();
    const request = http.expectOne('/api/v1/me');
    expect(request.request.body).toMatchObject({ firstName: 'Taylor' });
    request.flush(
      {
        error: {
          message: 'Invalid fields',
          details: [{ path: 'firstName', message: 'Name is not allowed' }],
        },
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await first;
    expect(page.profile.controls.firstName.errors?.['server']).toBe('Name is not allowed');
    expect(page.notice()).toBe('');
    expect(page.busy()).toBe(false);
    page.profile.controls.firstName.setValue('Morgan');
    const retry = page.saveProfile();
    http.expectOne('/api/v1/me').flush({ data: { ...user, firstName: 'Morgan' } });
    await retry;
    expect(page.notice()).toBe('Your profile has been saved.');
  });

  it('adds then edits an address without sending its database identity', async () => {
    page.openAddress();
    page.address.patchValue({ ...saved, country: 'us' });
    const add = page.saveAddress();
    const request = http.expectOne('/api/v1/me/addresses');
    expect(request.request.body).toMatchObject({ country: 'US' });
    expect(request.request.body).not.toHaveProperty('id');
    request.flush({ data: saved });
    await add;
    page.openAddress(saved);
    page.address.controls.line1.setValue('24 Main Street');
    const edit = page.saveAddress();
    const patch = http.expectOne('/api/v1/me/addresses/address-id');
    expect(patch.request.method).toBe('PATCH');
    patch.flush({ data: { ...saved, line1: '24 Main Street' } });
    await edit;
    expect(page.addresses()).toHaveLength(1);
    expect(page.addresses()[0]?.line1).toBe('24 Main Street');
    expect(page.addressFormOpen()).toBe(false);
  });

  it('keeps address removal pending when the server fails', async () => {
    page.addresses.set([saved]);
    page.pendingRemoval.set(saved);
    const remove = page.removeAddress();
    http
      .expectOne('/api/v1/me/addresses/address-id')
      .flush({}, { status: 503, statusText: 'Unavailable' });
    await remove;
    expect(page.addresses()).toEqual([saved]);
    expect(page.pendingRemoval()).toEqual(saved);
    expect(page.actionError()).toContain('temporarily unavailable');
  });

  it('requires matching strong passwords and signs out after changing', async () => {
    page.password.setValue({
      currentPassword: 'OldPassword9',
      newPassword: 'NewPassword8',
      confirmPassword: 'Different9',
    });
    await page.savePassword();
    http.expectNone('/api/v1/me/change-password');
    page.password.controls.confirmPassword.setValue('NewPassword8');
    const change = page.savePassword();
    const request = http.expectOne('/api/v1/me/change-password');
    expect(request.request.body).toEqual({
      currentPassword: 'OldPassword9',
      newPassword: 'NewPassword8',
    });
    request.flush(null);
    await change;
    expect(logout).toHaveBeenCalledOnce();
    expect(page.password.controls.newPassword.value).toBe('');
  });
});
