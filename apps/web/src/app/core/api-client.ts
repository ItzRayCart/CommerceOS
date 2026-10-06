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

  post<TResponse, TBody>(
    path: string,
    body: TBody,
    headers?: Record<string, string>,
  ): Observable<ApiEnvelope<TResponse>> {
    return this.http.post<ApiEnvelope<TResponse>>(`${this.baseUrl}${path}`, body, { headers });
  }
  patch<T>(path: string, body: unknown): Observable<ApiEnvelope<T>> {
    return this.http.patch<ApiEnvelope<T>>(`${this.baseUrl}${path}`, body);
  }
  put<T>(path: string, body: unknown): Observable<ApiEnvelope<T>> {
    return this.http.put<ApiEnvelope<T>>(`${this.baseUrl}${path}`, body);
  }
  delete(path: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}${path}`);
  }
  download(path: string, params: Record<string, string | number | boolean> = {}): Observable<Blob> {
    return this.http.get(`${this.baseUrl}${path}`, { params, responseType: 'blob' });
  }
}
