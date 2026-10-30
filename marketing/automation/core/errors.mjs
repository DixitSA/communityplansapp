export class AppError extends Error {
  constructor(code, message = code, status = 400) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
  }
}

export function publicError(error) {
  if (error instanceof AppError) return { status: error.status, body: { error: { code: error.code, message: error.message } } };
  if (error && /^meta_[a-z0-9_-]{1,32}$/i.test(error.code || '') && Number.isInteger(error.status)) {
    return { status: error.status, body: { error: { code: error.code, message: 'Meta API request failed.' } } };
  }
  return { status: 500, body: { error: { code: 'internal_error', message: 'The request could not be completed.' } } };
}
