export class RepositoryError extends Error {

  public constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'RepositoryError';
  }
}
