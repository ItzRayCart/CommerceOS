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
import { IconComponent } from '@web/shared/icon.component';
import { CartStore } from '@web/features/cart/cart.store';
import { WishlistStore } from '@web/features/catalog/wishlist-store';

@Component({
  selector: 'app-storefront-shell',
  imports: [RouterLink, RouterOutlet, ReactiveFormsModule, NgOptimizedImage, IconComponent],
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
          <app-icon name="menu" />
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
          (keydown.escape)="menuOpen.set(false)"
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
          <button type="submit" aria-label="Search"><app-icon name="search" /></button>
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
          <a routerLink="/account"
            ><app-icon name="user" /><span class="storefront__action-label">Account</span></a
          >
          @if (settings.data()?.features?.wishlist) {
            <a routerLink="/wishlist"
              ><app-icon name="heart" /><span class="storefront__action-label"
                >Wishlist ({{ wishlist.ids().length }})</span
              ></a
            >
          }
          <a routerLink="/cart"
            ><app-icon name="bag" /><span>Cart ({{ cart.count() }})</span></a
          >
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
        <p>{{ settings.data()?.store?.address }}</p>
      </div>
    </footer>
  `,
  styleUrl: './storefront-shell.component.scss',
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
