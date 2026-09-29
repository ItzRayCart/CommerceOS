import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { ApiEnvelope } from '@commerceos/shared';
import type { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1';

  get<T>(
    path: string,
    params?: Record<string, string | number | boolean>,
  ): Observable<ApiEnvelope<T>> {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params ?? {})) {
      httpParams = httpParams.set(key, String(value));
    }
    return this.http.get<ApiEnvelope<T>>(`${this.baseUrl}${path}`, { params: httpParams });
  }

  post<TResponse, TBody>(path: string, body: TBody): Observable<ApiEnvelope<TResponse>> {
    return this.http.post<ApiEnvelope<TResponse>>(`${this.baseUrl}${path}`, body);
  }
}
