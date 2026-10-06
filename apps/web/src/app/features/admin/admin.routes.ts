import type { CanDeactivateFn, Routes } from '@angular/router';
const unsaved: CanDeactivateFn<{ hasUnsavedChanges: () => boolean }> = (component) =>
  !component.hasUnsavedChanges() || window.confirm('Discard unsaved changes?');
export const adminRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'products',
    loadComponent: () => import('./products.component').then((m) => m.ProductsComponent),
  },
  {
    path: 'products/new',
    canDeactivate: [unsaved],
    loadComponent: () => import('./product-editor.component').then((m) => m.ProductEditorComponent),
  },
  {
    path: 'products/:id',
    canDeactivate: [unsaved],
    loadComponent: () => import('./product-editor.component').then((m) => m.ProductEditorComponent),
  },
  {
    path: 'categories',
    loadComponent: () => import('./categories.component').then((m) => m.CategoriesComponent),
  },
  {
    path: 'inventory',
    loadComponent: () => import('./inventory.component').then((m) => m.InventoryComponent),
  },
  {
    path: 'orders',
    loadComponent: () => import('./orders.component').then((m) => m.OrdersComponent),
  },
  {
    path: 'orders/:id',
    loadComponent: () => import('./order-detail.component').then((m) => m.OrderDetailComponent),
  },
  {
    path: 'customers',
    loadComponent: () => import('./customers.component').then((m) => m.CustomersComponent),
  },
  {
    path: 'customers/:id',
    loadComponent: () =>
      import('./customer-detail.component').then((m) => m.CustomerDetailComponent),
  },
  {
    path: 'discounts',
    loadComponent: () => import('./discounts.component').then((m) => m.DiscountsComponent),
  },
  {
    path: 'analytics',
    loadComponent: () => import('./analytics.component').then((m) => m.AnalyticsComponent),
  },
  {
    path: 'settings',
    canDeactivate: [unsaved],
    loadComponent: () => import('./settings.component').then((m) => m.SettingsComponent),
  },
];
