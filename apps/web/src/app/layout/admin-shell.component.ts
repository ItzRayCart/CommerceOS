import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'adm-shell',
  template: `
    <div class="admin-layout">
      <aside>CommerceOS Admin</aside>
      <main>
        <h1>Admin foundation</h1>
        <p>Protected admin features begin in Phase 1.</p>
      </main>
    </div>
  `,
  styles: [
    `
      .admin-layout {
        min-height: 100vh;
        display: grid;
        grid-template-columns: minmax(12rem, 16rem) 1fr;
      }
      aside {
        background: var(--color-ink);
        color: var(--color-surface);
        padding: 2rem;
      }
      main {
        padding: 2rem;
      }
      @media (max-width: 768px) {
        .admin-layout {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminShellComponent {}
