import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '@web/core/api-client';
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly client = inject(ApiClient);
  get<T>(path: string, params: Record<string, string | number | boolean> = {}) {
    return firstValueFrom(this.client.get<T>('/admin' + path, params));
  }
  post<T>(path: string, body: unknown) {
    return firstValueFrom(this.client.post<T, unknown>('/admin' + path, body));
  }
  patch<T>(path: string, body: unknown) {
    return firstValueFrom(this.client.patch<T>('/admin' + path, body));
  }
  put<T>(path: string, body: unknown) {
    return firstValueFrom(this.client.put<T>('/admin' + path, body));
  }
  delete(path: string) {
    return firstValueFrom(this.client.delete('/admin' + path));
  }
  upload(files: File[]) {
    const form = new FormData();
    files.forEach((file) => form.append('images', file));
    return this.post<{ url: string }[]>('/uploads/images', form);
  }
  async download(path: string, params: Record<string, string | number | boolean>) {
    const blob = await firstValueFrom(this.client.download('/admin' + path, params));
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = path.split('/').pop() ?? 'export.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
}
