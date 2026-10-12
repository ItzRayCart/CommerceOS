import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { AdminProduct, AdminCategory, AdminVariant } from '@commerceos/shared';
import { AdminApi } from './admin.api';
import { AdminState } from './admin-state';
import { AdminFeedbackComponent } from './admin-feedback.component';
import { generateMatrix } from './product-matrix';
import { errorMessage } from '@web/core/api-error';
@Component({
  selector: 'adm-product-editor',
  imports: [ReactiveFormsModule, RouterLink, AdminFeedbackComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./admin-page.scss', './product-editor.component.scss'],
  templateUrl: './product-editor.component.html',
})
export class ProductEditorComponent {
  readonly api = inject(AdminApi);
  readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  readonly state = new AdminState<AdminProduct>();
  private readonly fb = inject(NonNullableFormBuilder);
  readonly id = this.route.snapshot.paramMap.get('id');
  readonly categories = signal<AdminCategory[]>([]);
  readonly images = signal<AdminProduct['images']>([]);
  readonly uploaded = signal(false);
  readonly variants = signal<AdminVariant[]>([]);
  private baseline = '';
  private dragIndex = 0;
  readonly form = this.fb.group({
    name: ['', [Validators.required.bind(Validators), Validators.minLength(2)]],
    slug: '',
    description: ['', Validators.required.bind(Validators)],
    brand: '',
    category: ['', Validators.required.bind(Validators)],
    tags: '',
    status: ['draft'],
    isFeatured: false,
    metaTitle: '',
    metaDescription: '',
    options: this.fb.array([this.fb.group({ name: '', values: '' })]),
    specs: this.fb.array([this.fb.group({ label: '', value: '' })]),
  });
  constructor() {
    void this.load();
  }
  async load() {
    this.state.loading.set(true);
    try {
      this.categories.set(
        (await this.api.get<AdminCategory[]>('/categories', { limit: 100 })).data,
      );
      if (this.id) {
        const p = (await this.api.get<AdminProduct>(`/products/${this.id}`)).data;
        this.state.data.set(p);
        this.form.patchValue({
          name: p.name,
          slug: p.slug,
          description: p.description,
          brand: p.brand,
          category: p.category,
          tags: p.tags.join(', '),
          status: p.status,
          isFeatured: p.isFeatured,
          metaTitle: p.seo.metaTitle ?? '',
          metaDescription: p.seo.metaDescription ?? '',
        });
        this.form.controls.options.clear();
        p.optionDefinitions.forEach((o) =>
          this.form.controls.options.push(
            this.fb.group({ name: o.name, values: o.values.join(', ') }),
          ),
        );
        this.form.controls.specs.clear();
        p.specs.forEach((s) => this.form.controls.specs.push(this.fb.group(s)));
        this.images.set(p.images);
        this.variants.set(p.variants);
      } else this.variants.set(generateMatrix([], 'NEW', []));
      this.baseline = this.snapshot();
    } catch (e) {
      this.state.error.set(errorMessage(e));
    } finally {
      this.state.loading.set(false);
    }
  }
  snapshot() {
    return JSON.stringify({
      form: this.form.getRawValue(),
      images: this.images(),
      variants: this.variants(),
    });
  }
  hasUnsavedChanges() {
    return this.baseline !== this.snapshot();
  }
  addOption() {
    if (this.form.controls.options.length < 3)
      this.form.controls.options.push(this.fb.group({ name: '', values: '' }));
  }
  addSpec() {
    this.form.controls.specs.push(this.fb.group({ label: '', value: '' }));
  }
  generate() {
    try {
      const options = this.form.controls.options
        .getRawValue()
        .filter((o) => o.name || o.values)
        .map((o) => ({
          name: o.name.trim(),
          values: o.values
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean),
        }));
      const matrix = generateMatrix(
        options,
        this.form.controls.slug.value || this.form.controls.name.value,
        this.variants(),
      );
      const keep = this.variants()
        .filter((v) => v.id && !matrix.some((m) => m.id === v.id))
        .map((v) => ({ ...v, isActive: false }));
      this.variants.set([...matrix, ...keep]);
      this.state.error.set('');
    } catch (e) {
      this.state.error.set(e instanceof Error ? e.message : 'Check the options.');
    }
  }
  variantValue(
    i: number,
    field: 'sku' | 'price' | 'compareAtPrice' | 'stock' | 'lowStockThreshold',
    event: Event,
  ) {
    const value = (event.target as HTMLInputElement).value;
    this.variants.update((rows) =>
      rows.map((r, n) =>
        n === i
          ? {
              ...r,
              [field]:
                field === 'sku'
                  ? value
                  : field === 'compareAtPrice' && !value
                    ? undefined
                    : Number(value),
            }
          : r,
      ),
    );
  }
  toggleVariant(i: number, event: Event) {
    this.variants.update((rows) =>
      rows.map((r, n) =>
        n === i ? { ...r, isActive: (event.target as HTMLInputElement).checked } : r,
      ),
    );
  }
  optionLabel(v: AdminVariant) {
    return (
      Object.entries(v.options)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' / ') || 'Default'
    );
  }
  async upload(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (!files.length) return;
    this.uploaded.set(true);
    this.state.error.set('');
    try {
      const urls = (await this.api.upload(files)).data;
      if (this.images().length + urls.length > 10)
        throw new Error('A product allows at most ten images.');
      this.images.update((images) => [
        ...images,
        ...urls.map((u, i) => ({
          url: u.url,
          alt: this.form.controls.name.value || 'Product image',
          isPrimary: images.length === 0 && i === 0,
        })),
      ]);
      this.state.feedback.set('Images uploaded. Save the product to keep the media order.');
    } catch (e) {
      this.state.error.set(e instanceof Error && !('status' in e) ? e.message : errorMessage(e));
    } finally {
      this.uploaded.set(false);
      input.value = '';
    }
  }
  primary(index: number) {
    this.images.update((rows) => rows.map((r, i) => ({ ...r, isPrimary: i === index })));
  }
  alt(index: number, e: Event) {
    this.images.update((rows) =>
      rows.map((r, i) => (i === index ? { ...r, alt: (e.target as HTMLInputElement).value } : r)),
    );
  }
  removeImage(index: number) {
    this.images.update((rows) =>
      rows.filter((_, i) => i !== index).map((r, i) => ({ ...r, isPrimary: i === 0 })),
    );
  }
  drag(index: number) {
    this.dragIndex = index;
  }
  drop(index: number, e: DragEvent) {
    e.preventDefault();
    this.move(this.dragIndex, index);
  }
  move(from: number, to: number) {
    if (to < 0 || to >= this.images().length) return;
    this.images.update((rows) => {
      const next = [...rows];
      const image = next.splice(from, 1)[0];
      if (image) next.splice(to, 0, image);
      return next;
    });
  }
  async save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.state.error.set('Complete the required product fields.');
      return;
    }
    const v = this.form.getRawValue();
    const body = {
      name: v.name,
      ...(v.slug ? { slug: v.slug } : {}),
      description: v.description,
      brand: v.brand,
      category: v.category,
      tags: v.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      status: v.status,
      isFeatured: v.isFeatured,
      images: this.images(),
      variants: this.variants(),
      optionDefinitions: v.options
        .filter((o) => o.name || o.values)
        .map((o) => ({
          name: o.name.trim(),
          values: o.values
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean),
        })),
      specs: v.specs.filter((s) => s.label || s.value),
      seo: { metaTitle: v.metaTitle, metaDescription: v.metaDescription },
    };
    await this.state.mutate(
      async () => {
        const result = this.id
          ? await this.api.patch<AdminProduct>(`/products/${this.id}`, {
              ...body,
              expectedUpdatedAt: this.state.data()?.updatedAt,
            })
          : await this.api.post<AdminProduct>('/products', body);
        this.state.data.set(result.data);
        this.baseline = this.snapshot();
        if (!this.id) await this.router.navigate(['/admin/products', result.data.id]);
      },
      v.status === 'active'
        ? 'Product published. It is available in the storefront.'
        : 'Product saved.',
    );
  }
}
