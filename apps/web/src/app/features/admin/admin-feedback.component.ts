import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
@Component({
  selector: 'adm-feedback',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (loading()) {
      <div class="skeleton" role="status" aria-label="Loading data"></div>
    }
    @if (error()) {
      <div class="error" role="alert">
        <p>{{ error() }}</p>
        <button type="button" (click)="retry.emit()">Retry</button>
      </div>
    }
    @if (message()) {
      <p class="notice" role="status" aria-live="polite">{{ message() }}</p>
    }`,
  styles: [
    `
      .skeleton {
        height: 8rem;
        border-radius: var(--radius-card);
        background: var(--color-border);
        animation: pulse 1s ease-in-out infinite alternate;
      }
      .error,
      .notice {
        padding: 1rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-card);
      }
      .error {
        color: var(--color-danger);
      }
      .notice {
        color: var(--color-success);
      }
      @keyframes pulse {
        to {
          opacity: 0.45;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .skeleton {
          animation: none;
        }
      }
    `,
  ],
})
export class AdminFeedbackComponent {
  readonly loading = input(false);
  readonly error = input('');
  readonly message = input('');
  readonly retry = output<void>();
}
