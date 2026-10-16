export class GitHubError extends Error {

  public readonly status: number;

  public constructor(status: number, message: string) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
  }
}
