import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from '@web/app.config';
import { AppComponent } from '@web/app.component';

void bootstrapApplication(AppComponent, appConfig).catch((error: unknown) => {
  throw error;
});
