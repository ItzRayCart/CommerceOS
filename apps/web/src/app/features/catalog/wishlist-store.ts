import { HttpClient } from '@angular/common/http';
import { effect, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '@web/core/auth-session';
import { errorMessage } from '@web/core/api-error';

@Injectable({ providedIn: 'root' })
export class WishlistStore {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  readonly ids = signal<string[]>([]);
  readonly busy = signal(false);
  readonly message = signal('');
  constructor() {
    effect(() => {
      const user = this.auth.user();
      this.ids.set([]);
      if (user) void this.load(user.id);
    });
  }
  private async load(userId: string) {
    try {
      const pages = await Promise.all(
        [1, 2].map((page) =>
          firstValueFrom(
            this.http.get<{ data: { id: string }[] }>('/api/v1/wishlist', {
              params: { page, limit: 100 },
            }),
          ),
        ),
      );
      if (this.auth.user()?.id === userId)
        this.ids.set(pages.flatMap((page) => page.data.map((p) => p.id)));
    } catch (error) {
      this.message.set(errorMessage(error));
    }
  }
  async toggle(id: string) {
    if (!this.auth.user()) {
      await this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    if (this.busy()) return;
    this.busy.set(true);
    this.message.set('');
    try {
      const saved = this.ids().includes(id);
      await firstValueFrom(
        saved
          ? this.http.delete(`/api/v1/wishlist/${id}`)
          : this.http.post(`/api/v1/wishlist/${id}`, {}),
      );
      this.ids.update((ids) => (saved ? ids.filter((value) => value !== id) : [...ids, id]));
      this.message.set(saved ? 'Removed from wishlist.' : 'Saved to wishlist.');
    } catch (error) {
      this.message.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
