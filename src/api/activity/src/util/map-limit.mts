/** Runs `fn` over `items` with at most `limit` in flight. */
export const mapLimit = async <T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> => {
  const out: R[] = new Array<R>(items.length);
  let next: number = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const i: number = next;
      next += 1;
      out[i] = await fn(items[i] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
};
