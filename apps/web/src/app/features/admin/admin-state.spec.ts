import { describe, expect, it } from 'vitest';
import { AdminState } from './admin-state';
import type { ApiEnvelope } from '@commerceos/shared';
describe('Admin request state', () => {
  it('keeps the latest filter result when an earlier request finishes last', async () => {
    const state = new AdminState<string>();
    let finish!: (response: ApiEnvelope<string>) => void;
    const old = state.load(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await state.load(() => Promise.resolve({ data: 'New filter' }));
    finish({ data: 'Old filter' });
    await old;
    expect(state.data()).toBe('New filter');
    expect(state.loading()).toBe(false);
  });
  it('prevents duplicate submissions and allows a retry after failure', async () => {
    const state = new AdminState<string>();
    let finish!: () => void;
    const pending = state.mutate(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    expect(await state.mutate(async () => {})).toBe(false);
    finish();
    await pending;
    expect(state.busy()).toBe(false);
    expect(await state.mutate(() => Promise.reject(new Error('Failed')))).toBe(false);
    expect(state.error()).toBeTruthy();
    expect(state.feedback()).toBe('');
    expect(await state.mutate(async () => {}, 'Retried')).toBe(true);
    expect(state.feedback()).toBe('Retried');
  });
});
