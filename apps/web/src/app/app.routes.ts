import type { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard } from '@web/core/auth-session';

export const routes: Routes = [
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('@web/layout/admin-shell.component').then((module) => module.AdminShellComponent),
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('@web/auth/auth-page.component').then((m) => m.AuthPageComponent),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('@web/auth/auth-page.component').then((m) => m.AuthPageComponent),
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    loadComponent: () => import('@web/auth/auth-page.component').then((m) => m.AuthPageComponent),
  },
  {
    path: 'reset-password/:token',
    canActivate: [guestGuard],
    loadComponent: () => import('@web/auth/auth-page.component').then((m) => m.AuthPageComponent),
  },
  {
    path: 'account',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@web/auth/account-page.component').then((m) => m.AccountPageComponent),
  },
  {
    path: '',
    loadComponent: () =>
      import('@web/layout/storefront-shell.component').then(
        (module) => module.StorefrontShellComponent,
      ),
    children: [
      {
        path: 'products/:slug',
        loadComponent: () =>
          import('@web/features/catalog/product-page.component').then(
            (m) => m.ProductPageComponent,
          ),
      },
      {
        path: 'wishlist',
        canActivate: [authGuard],
        loadComponent: () =>
          import('@web/features/catalog/wishlist-page.component').then(
            (m) => m.WishlistPageComponent,
          ),
      },
      {
        path: 'cart',
        loadComponent: () =>
          import('@web/features/cart/cart-page.component').then((m) => m.CartPageComponent),
      },
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('@web/features/catalog/home-page.component').then((m) => m.HomePageComponent),
      },
      {
        path: 'shop',
        loadComponent: () =>
          import('@web/features/catalog/catalog-page.component').then(
            (m) => m.CatalogPageComponent,
          ),
      },
      {
        path: 'shop/:categorySlug',
        loadComponent: () =>
          import('@web/features/catalog/catalog-page.component').then(
            (m) => m.CatalogPageComponent,
          ),
      },
      {
        path: 'search',
        loadComponent: () =>
          import('@web/features/catalog/catalog-page.component').then(
            (m) => m.CatalogPageComponent,
          ),
      },
      {
        path: '**',
        loadComponent: () =>
          import('@web/features/catalog/not-found-page.component').then(
            (m) => m.NotFoundPageComponent,
          ),
      },
    ],
  },
];
