export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(404, 'NOT_FOUND', message);
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown) {
    super(422, 'VALIDATION_ERROR', 'Request validation failed', details);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request') {
    super(400, 'BAD_REQUEST', message);
  }
}
