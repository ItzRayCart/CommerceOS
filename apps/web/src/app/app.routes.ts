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
  },
];
