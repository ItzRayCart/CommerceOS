import { ChangeDetectionStrategy, Component, input } from '@angular/core';
const paths = {
  menu: 'M4 7h16M4 12h16M4 17h16',
  search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  user: 'M20 21v-2a7 7 0 0 0-14 0v2M17 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  bag: 'M5 7h14l1 14H4L5 7ZM8 7V5a4 4 0 0 1 8 0v2',
  heart:
    'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  arrow: 'M4 12h16M14 6l6 6-6 6',
  close: 'M6 6l12 12M18 6 6 18',
} as const;
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template:
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path [attr.d]="paths[name()]" /></svg>',
  styles: [':host{display:inline-flex;flex-shrink:0;vertical-align:middle}svg{display:block}'],
})
export class IconComponent {
  readonly name = input.required<keyof typeof paths>();
  readonly paths = paths;
}
