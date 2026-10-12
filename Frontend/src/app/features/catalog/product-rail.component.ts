import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { ElementRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ProductSummary } from './catalog.types';
import { ProductCardComponent } from './product-card.component';
import { IconComponent } from '@web/shared/icon.component';
import { inject } from '@angular/core';
import { SettingsStore } from '@web/core/settings-store';
@Component({
  selector: 'app-product-rail',
  imports: [RouterLink, ProductCardComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-rail.component.html',
  styleUrl: './product-rail.component.scss',
})
export class ProductRailComponent {
  readonly settings = inject(SettingsStore);
  readonly title = input.required<string>();
  readonly caption = input('');
  readonly id = input.required<string>();
  readonly items = input<ProductSummary[]>([]);
  readonly loading = input(false);
  readonly error = input('');
  readonly total = input<number | undefined>(undefined);
  readonly hasMore = input(false);
  readonly query = input<Record<string, string | number | boolean>>({});
  readonly badge = input('');
  readonly retry = output<void>();
  readonly loadMore = output<void>();
  readonly track = viewChild<ElementRef<HTMLDivElement>>('track');
  readonly canPrevious = signal(false);
  readonly canNext = signal(false);
  readonly titleId = computed(() => this.id() + '-title');
  readonly hintId = computed(() => this.id() + '-hint');
  constructor() {
    afterRenderEffect((cleanup) => {
      this.items();
      const element = this.track()?.nativeElement;
      if (!element) return;
      const observer = new ResizeObserver(() => this.measure());
      observer.observe(element);
      this.measure();
      cleanup(() => observer.disconnect());
    });
  }
  measure() {
    const element = this.track()?.nativeElement;
    if (!element) return;
    this.canPrevious.set(element.scrollLeft > 2);
    this.canNext.set(element.scrollLeft + element.clientWidth < element.scrollWidth - 2);
  }
  move(direction: number) {
    const element = this.track()?.nativeElement;
    if (!element) return;
    const reduced =
      element.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches ??
      true;
    element.scrollBy({
      left: direction * Math.max(240, element.clientWidth * 0.8),
      behavior: reduced ? 'instant' : 'smooth',
    });
  }
  key(event: KeyboardEvent) {
    const element = this.track()?.nativeElement;
    if (!element || event.target !== element || event.altKey || event.ctrlKey || event.metaKey)
      return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      this.move(event.key === 'ArrowRight' ? 1 : -1);
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      element.scrollTo({
        left: event.key === 'Home' ? 0 : element.scrollWidth,
        behavior: 'instant',
      });
    }
  }
}
