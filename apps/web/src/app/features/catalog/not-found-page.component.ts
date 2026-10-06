import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { SettingsStore } from '@web/core/settings-store';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<main class="page-container missing">
    <p class="eyebrow">404 · Page not found</p>
    <h1>Let's find your way back.</h1>
    <p class="muted">This page may have moved or is no longer available.</p>
    <a routerLink="/shop">Explore {{ settings.data()?.store?.name ?? 'the store' }}</a>
  </main>`,
  styles: [
    `
      .missing {
        min-height: 60vh;
        display: grid;
        align-content: center;
        justify-items: start;
      }
      .missing h1 {
        margin: 0.5rem 0;
      }
      .missing a {
        display: inline-block;
        margin-top: 1rem;
        padding: 0.75rem 1rem;
        border-radius: var(--radius-button);
        background: var(--color-ink);
        color: var(--color-surface);
      }
    `,
  ],
})
export class NotFoundPageComponent {
  readonly settings = inject(SettingsStore);
  private readonly title = inject(Title);
  constructor() {
    this.title.setTitle('Page not found');
  }
}
