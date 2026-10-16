export interface RestResponse<T> {
  status: number;
  data: T | null;
  /** x-ratelimit-remaining, when GitHub sent it. */
  rateRemaining: number | null;
}
