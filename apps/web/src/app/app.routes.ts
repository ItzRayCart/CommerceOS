import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'admin',
    loadComponent: () =>
      import('@web/layout/admin-shell.component').then((module) => module.AdminShellComponent),
  },
  {
    path: '',
    loadComponent: () =>
      import('@web/layout/storefront-shell.component').then(
        (module) => module.StorefrontShellComponent,
      ),
  },
];
