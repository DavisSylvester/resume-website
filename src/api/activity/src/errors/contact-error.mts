export const ContactErrorCode = {
  Invalid: 'invalid',
  RateLimited: 'rate_limited',
  NotConfigured: 'not_configured',
  DeliveryFailed: 'delivery_failed',
} as const;
export type ContactErrorCode = (typeof ContactErrorCode)[keyof typeof ContactErrorCode];

export class ContactError extends Error {

  public readonly code: ContactErrorCode;

  public constructor(code: ContactErrorCode, message: string) {
    super(message);
    this.name = 'ContactError';
    this.code = code;
  }

  public get status(): number {
    switch (this.code) {
      case ContactErrorCode.Invalid:
        return 400;
      case ContactErrorCode.RateLimited:
        return 429;
      case ContactErrorCode.NotConfigured:
        return 503;
      case ContactErrorCode.DeliveryFailed:
        return 502;
    }
  }
}
