import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-storefront-shell',
  imports: [RouterLink],
  template: `
    <header class="site-header">
      <a routerLink="/" aria-label="Store home">CommerceOS</a>
      <span>Storefront foundation</span>
    </header>
    <main>
      <h1>CommerceOS storefront</h1>
      <p>The catalogue will arrive in Phase 2.</p>
    </main>
  `,
  styles: [
    `
      .site-header {
        display: flex;
        justify-content: space-between;
        padding: 1.5rem;
        border-bottom: 1px solid var(--color-border);
      }
      main {
        max-width: 72rem;
        margin: auto;
        padding: 3rem 1.5rem;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StorefrontShellComponent {}
