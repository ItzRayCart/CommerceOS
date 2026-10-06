import { signal } from '@angular/core';
import type { ApiEnvelope, PaginationMeta } from '@commerceos/shared';
import { getApiError } from '@web/core/api-error';
export class AdminState<T> {
  private loadVersion = 0;
  readonly data = signal<T | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly feedback = signal('');
  readonly fields = signal<Record<string, string>>({});
  readonly meta = signal<PaginationMeta | null>(null);
  async load(fetch: () => Promise<ApiEnvelope<T>>) {
    const version = ++this.loadVersion;
    this.loading.set(true);
    this.error.set('');
    try {
      const r = await fetch();
      if (version !== this.loadVersion) return;
      this.data.set(r.data);
      this.meta.set(r.meta ?? null);
    } catch (e) {
      if (version === this.loadVersion) this.error.set(getApiError(e).message);
    } finally {
      if (version === this.loadVersion) this.loading.set(false);
    }
  }
  async mutate(work: () => Promise<unknown>, success = 'Saved successfully.'): Promise<boolean> {
    if (this.busy()) return false;
    this.busy.set(true);
    this.error.set('');
    this.fields.set({});
    this.feedback.set('');
    try {
      await work();
      this.feedback.set(success);
      return true;
    } catch (e) {
      const err = getApiError(e);
      this.error.set(err.message);
      const fields: Record<string, string> = {};
      if (Array.isArray(err.details)) {
        for (const d of err.details as { path?: string; message?: string }[]) {
          if (d.path) fields[d.path] = d.message ?? 'Invalid value';
        }
      } else if (
        err.details &&
        typeof err.details === 'object' &&
        'field' in err.details &&
        typeof err.details.field === 'string'
      )
        fields[err.details.field] = err.message;
      this.fields.set(fields);
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}
