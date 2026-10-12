import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { RevenuePoint } from '@commerceos/shared';
@Component({
  selector: 'adm-revenue-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (points().length) {
      <svg viewBox="0 0 600 180" role="img" aria-label="Revenue over time">
        <path d="M20 10V150H590" class="axis" />
        <path [attr.d]="path()" class="line" />
      </svg>
      <p>
        {{ points()[0]?.date }} — {{ points()[points().length - 1]?.date }} · Revenue in minor units
      </p>
    } @else {
      <p>No revenue in this period. Paid orders will appear here.</p>
    }`,
  styles: [
    `
      svg {
        display: block;
        width: 100%;
        height: auto;
      }
      .axis {
        fill: none;
        stroke: var(--color-border);
        stroke-width: 1;
      }
      .line {
        fill: none;
        stroke: var(--color-accent);
        stroke-width: 3;
      }
      p {
        font-size: 0.75rem;
        color: var(--color-muted);
      }
    `,
  ],
})
export class RevenueChartComponent {
  readonly points = input<RevenuePoint[]>([]);
  readonly path = computed(() => {
    const p = this.points();
    const max = Math.max(1, ...p.map((p) => p.revenue));
    return p
      .map(
        (p, i) =>
          `${i ? 'L' : 'M'}${20 + (i * 570) / Math.max(1, this.points().length - 1)} ${150 - (p.revenue / max) * 130}`,
      )
      .join(' ');
  });
}
