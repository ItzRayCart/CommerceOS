import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { ApiEnvelope } from '@commerceos/shared';
import type { SessionUser } from '@web/core/auth-session';

export interface AddressView {
  id: string;
  label: string;
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  phone: string;
  isDefault: boolean;
}

@Injectable({ providedIn: 'root' })
export class AccountApi {
  private readonly http = inject(HttpClient);
  me() {
    return this.http.get<ApiEnvelope<SessionUser>>('/api/v1/auth/me');
  }
  updateProfile(body: { firstName: string; lastName: string; phone?: string }) {
    return this.http.patch<ApiEnvelope<SessionUser>>('/api/v1/me', body);
  }
  changePassword(body: { currentPassword: string; newPassword: string }) {
    return this.http.post<void>('/api/v1/me/change-password', body);
  }
  addresses() {
    return this.http.get<ApiEnvelope<AddressView[]>>('/api/v1/me/addresses');
  }
  addAddress(body: Omit<AddressView, 'id' | 'isDefault'> & { isDefault?: boolean }) {
    return this.http.post<ApiEnvelope<AddressView>>('/api/v1/me/addresses', body);
  }
  setDefault(id: string) {
    return this.http.patch<ApiEnvelope<AddressView>>(`/api/v1/me/addresses/${id}`, {
      isDefault: true,
    });
  }
  deleteAddress(id: string) {
    return this.http.delete<void>(`/api/v1/me/addresses/${id}`);
  }
}
