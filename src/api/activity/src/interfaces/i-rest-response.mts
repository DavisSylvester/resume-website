export interface RestResponse<T> {
  status: number;
  data: T | null;
}
