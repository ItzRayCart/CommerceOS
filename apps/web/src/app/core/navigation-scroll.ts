import { ViewportScroller } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
@Injectable({ providedIn: 'root' })
export class NavigationScroll {
  private readonly router = inject(Router);
  private readonly viewport = inject(ViewportScroller);
  constructor() {
    let previousPath = '';
    let restoreTop = true;
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationStart) restoreTop = event.navigationTrigger === 'imperative';
      if (!(event instanceof NavigationEnd)) return;
      const path = event.urlAfterRedirects.split(/[?#]/)[0] ?? '/';
      // Keep query-only edits in place and let native browser history restore back/forward.
      if (restoreTop && path !== previousPath) this.viewport.scrollToPosition([0, 0]);
      previousPath = path;
    });
  }
}
