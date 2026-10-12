import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SettingsStore } from '@web/core/settings-store';
import { Title } from '@angular/platform-browser';
import { errorMessage } from '@web/core/api-error';
import { ProductCardComponent } from './product-card.component';
import type { ProductSummary } from './catalog.types';
import { WishlistStore } from './wishlist-store';

@Component({
  selector: 'app-wishlist-page',
  imports: [RouterLink, ProductCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<main class="page-container">
    <p class="eyebrow">Saved for later</p>
    <h1>Your wishlist</h1>
    @if (error()) {
      <p role="alert">{{ error() }}</p>
      <button (click)="load()">Retry</button>
    }
    @if (loading()) {
      <p role="status">Loading your wishlist…</p>
    } @else {
      <div class="grid">
        @for (product of products(); track product.id) {
          <div>
            <app-product-card
              [product]="product"
              [price]="settings.formatMoney(product.priceFrom)"
            />
            <button [disabled]="busy()" (click)="remove(product.id)">Remove from wishlist</button>
          </div>
        } @empty {
          <p>No saved products yet. <a routerLink="/shop">Explore the collection</a></p>
        }
      </div>
      <nav aria-label="Wishlist pages">
        <button [disabled]="page() === 1 || busy()" (click)="changePage(-1)">Previous</button>
        <span>Page {{ page() }}</span
        ><button [disabled]="!hasNext() || busy()" (click)="changePage(1)">Next</button>
      </nav>
    }
    <p role="status">{{ notice() }}</p>
  </main>`,
  styles: [
    `
      .grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 2rem;
      }
      nav {
        display: flex;
        gap: 1rem;
        align-items: center;
        margin-top: 2rem;
      }
      [role='alert'] {
        color: var(--color-danger);
      }
      @media (max-width: 768px) {
        .grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1rem;
        }
      }
    `,
  ],
})
export class WishlistPageComponent {
  private readonly http = inject(HttpClient);
  private readonly title = inject(Title);
  readonly wishlist = inject(WishlistStore);
  readonly settings = inject(SettingsStore);
  readonly products = signal<ProductSummary[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly page = signal(1);
  readonly hasNext = signal(false);
  constructor() {
    this.title.setTitle('Your wishlist');
    void this.load();
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await firstValueFrom(
        this.http.get<{ data: ProductSummary[]; meta: { hasNext: boolean } }>('/api/v1/wishlist', {
          params: { page: this.page() },
        }),
      );
      this.products.set(result.data);
      this.hasNext.set(result.meta.hasNext);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
  changePage(delta: number) {
    this.page.update((page) => page + delta);
    void this.load();
  }
  async remove(id: string) {
    this.busy.set(true);
    try {
      await this.wishlist.toggle(id);
      this.notice.set(this.wishlist.message());
      await this.load();
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
