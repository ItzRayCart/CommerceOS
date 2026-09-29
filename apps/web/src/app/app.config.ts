import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import type { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from '@web/app.routes';

export const appConfig: ApplicationConfig = {
  providers: [provideZonelessChangeDetection(), provideHttpClient(), provideRouter(routes)],
};
