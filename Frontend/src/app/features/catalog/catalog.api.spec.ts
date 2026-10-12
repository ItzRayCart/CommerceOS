import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CatalogApi } from './catalog.api';
let api: CatalogApi, http: HttpTestingController;
beforeEach(() => {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  api = TestBed.inject(CatalogApi);
  http = TestBed.inject(HttpTestingController);
});
afterEach(() => http.verify());
describe('concurrent category requests', () => {
  it('shares the in-flight request but fetches fresh categories on a later visit', async () => {
    const a = firstValueFrom(api.categories()),
      b = firstValueFrom(api.categories());
    http.expectOne('/api/v1/categories').flush({ data: [] });
    await expect(a).resolves.toEqual({ data: [] });
    await expect(b).resolves.toEqual({ data: [] });
    const later = firstValueFrom(api.categories());
    http.expectOne('/api/v1/categories').flush({ data: [] });
    await later;
  });
  it('resets after failure so retry can succeed', async () => {
    const failed = firstValueFrom(api.categories()).catch(() => null);
    http
      .expectOne('/api/v1/categories')
      .flush('Unavailable', { status: 503, statusText: 'Unavailable' });
    await expect(failed).resolves.toBeNull();
    const retried = firstValueFrom(api.categories());
    http.expectOne('/api/v1/categories').flush({ data: [] });
    await expect(retried).resolves.toEqual({ data: [] });
  });
});
