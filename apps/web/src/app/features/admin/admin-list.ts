import { inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminState } from './admin-state';
import { AdminApi } from './admin.api';
export class AdminList<T> {
  readonly api = inject(AdminApi);
  readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  readonly state = new AdminState<T[]>();
  params: Record<string, string | number | boolean> = {};
  constructor(readonly path: string) {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((p) => {
      this.params = Object.fromEntries(p.keys.map((k) => [k, p.get(k) ?? '']));
      void this.load();
    });
  }
  async load() {
    await this.state.load(() => this.api.get<T[]>(this.path, this.params));
  }
  filter(values: Record<string, string | number | boolean | null>) {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ...values, page: 1 },
      queryParamsHandling: 'merge',
    });
  }
  page(value: number) {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: value },
      queryParamsHandling: 'merge',
    });
  }
  limit(value: number) {
    this.filter({ limit: value });
  }
}
