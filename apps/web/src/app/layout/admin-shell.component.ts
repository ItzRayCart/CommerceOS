import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SettingsStore } from '@web/core/settings-store';
import { AuthStore } from '@web/core/auth-session';
@Component({
  selector: 'adm-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="admin">
    <aside [class.admin__open]="isOpen()">
      <a routerLink="/admin" class="admin__brand"
        >{{ settings.data()?.store?.name || 'CommerceOS' }}<span>Store administration</span></a
      >
      <nav aria-label="Admin navigation">
        @for (item of links; track item.path) {
          <a
            [routerLink]="item.path"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: item.path === '/admin' }"
            (click)="isOpen.set(false)"
            >{{ item.name }}</a
          >
        }
      </nav>
      <a routerLink="/">View storefront ↗</a>
    </aside>
    <div class="admin__canvas">
      <header>
        <button class="admin__menu" (click)="isOpen.set(!isOpen())" [attr.aria-expanded]="isOpen()">
          Menu</button
        ><span>CommerceOS / {{ settings.data()?.store?.name }}</span
        ><a routerLink="/account">{{ auth.user()?.firstName }}</a>
      </header>
      <main><router-outlet /></main>
    </div>
  </div>`,
  styleUrl: './admin-shell.component.scss',
})
export class AdminShellComponent {
  readonly settings = inject(SettingsStore);
  readonly auth = inject(AuthStore);
  readonly isOpen = signal(false);
  readonly links = [
    { path: '/admin', name: 'Overview' },
    { path: '/admin/products', name: 'Products' },
    { path: '/admin/categories', name: 'Categories' },
    { path: '/admin/inventory', name: 'Inventory' },
    { path: '/admin/orders', name: 'Orders' },
    { path: '/admin/customers', name: 'Customers' },
    { path: '/admin/discounts', name: 'Discounts' },
    { path: '/admin/analytics', name: 'Analytics' },
    { path: '/admin/settings', name: 'Settings' },
  ];
  constructor() {
    void this.settings.load();
  }
}
