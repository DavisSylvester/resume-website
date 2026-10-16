export const WebhookErrorCode = {
  BadSignature: 'bad_signature',
  BadPayload: 'bad_payload',
  NotConfigured: 'not_configured',
  StorageFailed: 'storage_failed',
} as const;
export type WebhookErrorCode = (typeof WebhookErrorCode)[keyof typeof WebhookErrorCode];

export class WebhookError extends Error {

  public readonly code: WebhookErrorCode;

  public constructor(code: WebhookErrorCode, message: string) {
    super(message);
    this.name = 'WebhookError';
    this.code = code;
  }

  public get status(): number {
    switch (this.code) {
      case WebhookErrorCode.BadSignature:
        return 401;
      case WebhookErrorCode.BadPayload:
        return 400;
      case WebhookErrorCode.NotConfigured:
      case WebhookErrorCode.StorageFailed:
        return 503;
    }
  }
}
