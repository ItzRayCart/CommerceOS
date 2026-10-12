import type { ElementRef } from '@angular/core';
import { ChangeDetectionStrategy, Component, viewChild, signal } from '@angular/core';
@Component({
  selector: 'adm-confirm',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<dialog #dialog aria-labelledby="confirm-title" (cancel)="finish(false)">
    <h2 id="confirm-title">{{ title() }}</h2>
    <p>{{ text() }}</p>
    <div>
      <button (click)="finish(false)">Keep it</button
      ><button class="danger" (click)="finish(true)">Confirm</button>
    </div>
  </dialog>`,
  styles: [
    `
      dialog {
        max-width: 32rem;
        width: calc(100% - 2rem);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-card);
        padding: 2rem;
        background: var(--color-surface);
        color: var(--color-ink);
      }
      dialog::backdrop {
        background: color-mix(in srgb, var(--color-ink) 50%, transparent);
      }
      div {
        display: flex;
        gap: 1rem;
        justify-content: flex-end;
      }
      .danger {
        color: var(--color-danger);
      }
    `,
  ],
})
export class AdminConfirmComponent {
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  readonly title = signal('');
  readonly text = signal('');
  private resolve: ((value: boolean) => void) | null = null;
  ask(title: string, text: string): Promise<boolean> {
    this.title.set(title);
    this.text.set(text);
    this.dialog().nativeElement.showModal();
    return new Promise((resolve) => (this.resolve = resolve));
  }
  finish(value: boolean) {
    this.dialog().nativeElement.close();
    this.resolve?.(value);
    this.resolve = null;
  }
}
