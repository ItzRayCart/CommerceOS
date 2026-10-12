import { HttpErrorResponse } from '@angular/common/http';
export function getApiError(error: unknown): { message: string; details: unknown } {
  let details: unknown;
  if (error instanceof HttpErrorResponse) {
    const body: unknown = error.error;
    if (body && typeof body === 'object' && 'error' in body) {
      const value: unknown = body.error;
      if (value && typeof value === 'object' && 'details' in value) details = value.details;
    }
  }
  return { message: errorMessage(error), details };
}

export function errorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (!(error instanceof HttpErrorResponse)) return fallback;
  if (error.status === 0) return 'We cannot reach the store. Check your connection and try again.';
  if (error.status >= 500) return 'The store is temporarily unavailable. Please try again shortly.';
  const body: unknown = error.error;
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const detail: unknown = body.error;
    if (typeof detail === 'object' && detail !== null) {
      if ('details' in detail && Array.isArray(detail.details)) {
        const first: unknown = detail.details[0];
        if (
          typeof first === 'object' &&
          first !== null &&
          'message' in first &&
          typeof first.message === 'string'
        )
          return first.message;
      }
      if ('message' in detail && typeof detail.message === 'string') return detail.message;
    }
  }
  return fallback;
}
