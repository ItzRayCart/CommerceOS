import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import type { ElementRef } from '@angular/core';
import type { OnInit } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { SettingsStore } from '@web/core/settings-store';
import { NgOptimizedImage } from '@angular/common';
import { CatalogApi } from '@web/features/catalog/catalog.api';
import type { CategoryView } from '@web/features/catalog/catalog.types';
import { CartStore } from '@web/features/cart/cart.store';
import { WishlistStore } from '@web/features/catalog/wishlist-store';

@Component({
  selector: 'app-storefront-shell',
  imports: [RouterLink, RouterOutlet, ReactiveFormsModule, NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (settings.data()?.store?.announcement; as announcement) {
      <div class="storefront__announcement">{{ announcement }}</div>
    }
    <header class="storefront__header">
      <div class="storefront__header-inner">
        <button
          class="storefront__menu-button"
          type="button"
          aria-label="Toggle categories"
          [attr.aria-expanded]="menuOpen()"
          (click)="menuOpen.set(!menuOpen())"
        >
          ☰
        </button>
        <a class="storefront__brand" routerLink="/" (click)="menuOpen.set(false)">
          @if (settings.data()?.store?.logoUrl; as logo) {
            <img [ngSrc]="logo" alt="" width="32" height="32" priority />
          }
          <span>{{ settings.data()?.store?.name ?? 'CommerceOS' }}</span>
        </a>
        <nav
          class="storefront__categories"
          [class.storefront__categories--open]="menuOpen()"
          aria-label="Product categories"
        >
          <a routerLink="/shop" (click)="menuOpen.set(false)">Shop all</a>
          @for (category of categories(); track category.id) {
            <a [routerLink]="['/shop', category.slug]" (click)="menuOpen.set(false)">{{
              category.name
            }}</a>
          }
        </nav>
        <form class="storefront__search" role="search" (submit)="search($event)">
          <label class="sr-only" for="site-search">Search products</label>
          <input
            id="site-search"
            type="search"
            [formControl]="searchControl"
            placeholder="Search products"
            autocomplete="off"
          />
          <button type="submit" aria-label="Search">Search</button>
          @if (suggestions().length) {
            <ul class="storefront__suggestions" aria-label="Search suggestions">
              @for (item of suggestions(); track item.type + item.slug) {
                <li>
                  <a
                    [routerLink]="
                      item.type === 'product' ? ['/products', item.slug] : ['/shop', item.slug]
                    "
                    (click)="suggestions.set([])"
                    >{{ item.name }}</a
                  >
                </li>
              }
            </ul>
          }
        </form>
        <nav class="storefront__actions" aria-label="Account and shopping">
          <a routerLink="/account">Account</a>
          @if (settings.data()?.features?.wishlist) {
            <a routerLink="/wishlist">Wishlist ({{ wishlist.ids().length }})</a>
          }
          <a routerLink="/cart">Cart ({{ cart.count() }})</a>
        </nav>
      </div>
    </header>
    @if (settings.error()) {
      <div class="storefront__settings-error" role="alert">
        Store information could not load.
        <button type="button" (click)="settings.load()">Retry</button>
      </div>
    }
    @if (wishlist.message()) {
      <div class="storefront__toast" role="status">
        {{ wishlist.message() }}
        <button type="button" (click)="wishlist.message.set('')" aria-label="Dismiss message">
          ×
        </button>
      </div>
    }
    <router-outlet />
    <dialog
      #cartDialog
      class="cart-drawer"
      aria-label="Shopping cart"
      (close)="cart.drawerOpen.set(false)"
    >
      <div class="cart-drawer__header">
        <h2>Your cart</h2>
        <button type="button" (click)="cart.drawerOpen.set(false)" aria-label="Close cart">
          ×
        </button>
      </div>
      <p role="status">{{ cart.notice() }}</p>
      @for (line of cart.quote().lines; track line.id) {
        <p>
          <strong>{{ line.name }}</strong
          ><br />{{ line.variantLabel }} · {{ line.quantity }} ×
          {{ settings.formatMoney(line.unitPrice) }}
        </p>
      }
      <p>
        <strong>Estimated total {{ settings.formatMoney(cart.quote().totals.total) }}</strong>
      </p>
      <a routerLink="/cart" (click)="cart.drawerOpen.set(false)">View cart and totals</a>
    </dialog>
    <footer class="storefront__footer">
      <div>
        <strong>{{ settings.data()?.store?.name ?? 'CommerceOS' }}</strong>
        <p>{{ settings.data()?.store?.tagline }}</p>
      </div>
      <div>
        <strong>Explore</strong><a routerLink="/shop">Shop all</a><a routerLink="/search">Search</a>
      </div>
      <div>
        <strong>Help</strong
        ><a [href]="'mailto:' + (settings.data()?.store?.supportEmail ?? '')">{{
          settings.data()?.store?.supportEmail
        }}</a>
        <p>{{ settings.data()?.store?.phone }}</p>
      </div>
    </footer>
  `,
  styles: [
    `
      .storefront__announcement {
        text-align: center;
        padding: 0.45rem 1rem;
        background: var(--color-ink);
        color: var(--color-surface);
        font-size: 0.78rem;
        letter-spacing: 0.04em;
      }
      .storefront__header {
        position: sticky;
        top: 0;
        z-index: 20;
        background: var(--color-bg);
        border-bottom: 1px solid var(--color-border);
      }
      .storefront__header-inner {
        max-width: 88rem;
        margin: auto;
        min-height: 5rem;
        padding: 0.8rem 1.25rem;
        display: flex;
        align-items: center;
        gap: 1.4rem;
      }
      .storefront__brand {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        font-family: var(--font-display);
        font-weight: 700;
        letter-spacing: 0.14em;
        font-size: 1.15rem;
        white-space: nowrap;
      }
      .storefront__brand img {
        border-radius: 0.35rem;
      }
      .storefront__categories,
      .storefront__actions {
        display: flex;
        align-items: center;
        gap: 1.15rem;
        font-size: 0.85rem;
        white-space: nowrap;
      }
      .storefront__categories a:hover,
      .storefront__actions a:hover {
        color: var(--color-accent);
      }
      .storefront__search {
        position: relative;
        display: flex;
        flex: 1;
        max-width: 22rem;
        margin-left: auto;
      }
      .storefront__search input {
        width: 100%;
        min-width: 0;
        border-radius: var(--radius-button) 0 0 var(--radius-button);
      }
      .storefront__search button {
        border-radius: 0 var(--radius-button) var(--radius-button) 0;
      }
      .storefront__suggestions {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        margin: 0.25rem 0 0;
        padding: 0.4rem;
        list-style: none;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        box-shadow: var(--shadow-raised);
        border-radius: var(--radius-card);
      }
      .storefront__suggestions a {
        display: block;
        padding: 0.7rem;
      }
      .storefront__suggestions a:hover {
        background: var(--color-bg);
      }
      .storefront__menu-button {
        display: none;
      }
      .storefront__settings-error {
        padding: 1rem;
        text-align: center;
        color: var(--color-danger);
      }
      .storefront__toast {
        position: fixed;
        bottom: 1rem;
        right: 1rem;
        z-index: 40;
        background: var(--color-ink);
        color: var(--color-surface);
        padding: 0.5rem 0.75rem 0.5rem 1rem;
        border-radius: var(--radius-button);
        box-shadow: var(--shadow-raised);
      }
      .storefront__toast button {
        border: 0;
        font-size: 1.1rem;
        padding: 0.3rem;
        margin-left: 0.5rem;
      }
      .storefront__footer {
        display: grid;
        grid-template-columns: 2fr 1fr 1fr;
        gap: 2rem;
        padding: 4rem max(1.25rem, calc((100vw - 82rem) / 2));
        background: var(--color-ink);
        color: var(--color-surface);
      }
      .storefront__footer div {
        display: grid;
        align-content: start;
        gap: 0.6rem;
      }
      .storefront__footer p {
        margin: 0;
        color: var(--color-on-dark-muted);
      }
      .cart-drawer {
        position: fixed;
        inset: 0 0 0 auto;
        width: min(26rem, 100vw);
        height: 100vh;
        max-height: none;
        margin: 0;
        padding: 1.5rem;
        border: 0;
        box-shadow: var(--shadow-raised);
        background: var(--color-surface);
      }
      .cart-drawer::backdrop {
        background: var(--color-backdrop);
      }
      .cart-drawer__header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .cart-drawer__header button {
        font-size: 1.5rem;
      }
      @media (max-width: 1024px) {
        .storefront__header-inner {
          flex-wrap: wrap;
        }
        .storefront__menu-button {
          display: inline-flex;
        }
        .storefront__categories {
          display: none;
          order: 5;
          width: 100%;
          flex-wrap: wrap;
          padding: 0.75rem 0;
        }
        .storefront__categories--open {
          display: flex;
        }
        .storefront__search {
          max-width: none;
          flex-basis: 38%;
        }
      }
      @media (max-width: 680px) {
        .storefront__header-inner {
          gap: 0.65rem;
        }
        .storefront__search {
          order: 4;
          flex-basis: 100%;
        }
        .storefront__actions {
          margin-left: auto;
          gap: 0.6rem;
          font-size: 0.75rem;
        }
        .storefront__footer {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class StorefrontShellComponent implements OnInit {
  readonly settings = inject(SettingsStore);
  readonly cart = inject(CartStore);
  readonly wishlist = inject(WishlistStore);
  private readonly api = inject(CatalogApi);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly categories = signal<CategoryView[]>([]);
  readonly suggestions = signal<{ type: 'product' | 'category'; name: string; slug: string }[]>([]);
  readonly menuOpen = signal(false);
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly cartDialog = viewChild<ElementRef<HTMLDialogElement>>('cartDialog');
  constructor() {
    effect(() => {
      const element = this.cartDialog()?.nativeElement;
      if (!element) return;
      if (this.cart.drawerOpen() && !element.open) element.showModal();
      else if (!this.cart.drawerOpen() && element.open) element.close();
    });
  }

  ngOnInit(): void {
    void this.settings.load();
    void firstValueFrom(this.api.categories())
      .then((result) => this.categories.set(result.data))
      .catch(() => this.categories.set([]));
    this.searchControl.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((q) =>
          q.trim().length >= 2
            ? this.api.suggest(q.trim()).pipe(catchError(() => of({ data: [] })))
            : of({ data: [] }),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => this.suggestions.set(result.data));
  }

  search(event: Event): void {
    event.preventDefault();
    const q = this.searchControl.value.trim();
    this.suggestions.set([]);
    if (q) void this.router.navigate(['/search'], { queryParams: { q } });
  }
}
