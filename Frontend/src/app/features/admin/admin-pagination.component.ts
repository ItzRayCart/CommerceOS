import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { PaginationMeta } from '@commerceos/shared';
@Component({
  selector: 'adm-pagination',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (meta(); as m) {
    <nav aria-label="Pagination">
      <button [disabled]="!m.hasPrev" (click)="page.emit(m.page - 1)">Previous</button
      ><span>Page {{ m.page }} of {{ m.totalPages || 1 }} · {{ m.total }} records</span
      ><button [disabled]="!m.hasNext" (click)="page.emit(m.page + 1)">Next</button
      ><label
        >Per page
        <select [value]="m.limit" (change)="limit.emit(+$any($event.target).value)">
          @for (n of [10, 20, 50, 100]; track n) {
            <option [value]="n">{{ n }}</option>
          }
        </select></label
      >
    </nav>
  }`,
  styles: [
    `
      nav {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 1rem;
        margin-top: 1.5rem;
      }
      label {
        display: flex;
        gap: 0.5rem;
        align-items: center;
      }
      select {
        width: auto;
      }
    `,
  ],
})
export class AdminPaginationComponent {
  readonly meta = input<PaginationMeta | null>(null);
  readonly page = output<number>();
  readonly limit = output<number>();
}
