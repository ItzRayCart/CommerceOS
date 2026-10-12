import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import type { OnInit } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SettingsStore } from '@web/core/settings-store';
import { CatalogApi } from './catalog.api';
import type { CategoryView } from './catalog.types';
import { HomeCollection } from './home-collection';
import { ProductRailComponent } from './product-rail.component';
import { errorMessage } from '@web/core/api-error';
@Component({
  selector: 'app-home-page',
  imports: [RouterLink, NgOptimizedImage, ProductRailComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
})
export class HomePageComponent implements OnInit {
  readonly settings = inject(SettingsStore);
  private readonly api = inject(CatalogApi);
  readonly collections = [
    new HomeCollection(this.api, 'premium', 'Premium', 'Selected with care.', {
      collection: 'premium',
    }),
    new HomeCollection(this.api, 'hot', 'Hot', 'New picks. Ready now.', { collection: 'hot' }),
    new HomeCollection(this.api, 'best-selling', 'Best Selling', 'Your favourites, ranked.', {
      collection: 'best-selling',
    }),
    new HomeCollection(this.api, 'new', 'New Arrivals', 'Just added.', { sort: '-createdAt' }),
  ];
  readonly categories = signal<CategoryView[]>([]);
  readonly categoryLoading = signal(true);
  readonly categoryError = signal('');
  readonly hero = computed(() => {
    if (this.collections[0].loading()) return undefined;
    return this.collections.flatMap((c) => c.products()).find((p) => p.inStock && p.primaryImage);
  });
  readonly allFailed = computed(() =>
    this.collections.every((c) => !!c.error() && !c.products().length && !c.loading()),
  );
  ngOnInit() {
    void this.load();
  }
  async load() {
    await Promise.all([...this.collections.map((c) => c.load()), this.loadCategories()]);
  }
  async loadCategories() {
    this.categoryLoading.set(true);
    this.categoryError.set('');
    try {
      this.categories.set((await firstValueFrom(this.api.categories())).data);
    } catch (error) {
      this.categoryError.set(errorMessage(error, 'Categories could not load.'));
    } finally {
      this.categoryLoading.set(false);
    }
  }
}
